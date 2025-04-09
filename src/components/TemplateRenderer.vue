<template>
  <div class="template-container">
    <h1 v-if="template">{{ template.name }}</h1>
    <p class="description" v-if="template">{{ template.description }}</p>

    <form v-if="template" @submit.prevent="submitForm">
      <div
          v-for="field in sortedFields"
          :key="field.id"
          class="form-field"
      >
        <label :for="`field_${field.id}`" class="field-label">
          {{ field.field_name }}
          <span v-if="field.is_required" class="required">*</span>
        </label>

        <!-- 只保留文本和文本区域 -->
        <div class="field-input">
          <!-- 普通文本输入 -->
          <input
              v-if="
                            field.field_type === 'text' ||
                            field.field_type === 'number' ||
                            field.field_type === 'date'
                        "
              :id="`field_${field.id}`"
              v-model="formData[field.field_key]"
              :type="
                            field.field_type === 'number'
                                ? 'number'
                                : field.field_type === 'date'
                                ? 'date'
                                : 'text'
                        "
              class="input-text"
              :required="field.is_required"
              :placeholder="`请输入${field.field_name}`"
          />

          <!-- 长文本区域 -->
          <textarea
              v-else-if="field.field_type === 'textarea'"
              :id="`field_${field.id}`"
              v-model="formData[field.field_key]"
              class="input-textarea"
              :required="field.is_required"
              :placeholder="`请输入${field.field_name}`"
              rows="4"
          ></textarea>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-submit">提交</button>
        <button
            type="button"
            class="btn-preview"
            @click="previewAgreement"
        >
          预览协议
        </button>
      </div>
    </form>

    <!-- 预览模态框 -->
    <div v-if="showPreview" class="preview-modal">
      <div class="preview-content">
        <h2>协议预览</h2>
        <div class="preview-text" v-html="renderedContent"></div>
        <div class="preview-actions">
          <button @click="showPreview = false" class="btn-close">
            关闭
          </button>
          <button @click="downloadAgreement" class="btn-download">
            下载
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script lang="ts">
import axios from "axios";
import { defineComponent, PropType } from 'vue';

// 字段接口定义
interface TemplateField {
  id: number;
  field_name: string;  // 字段显示名称
  field_key: string;   // 字段在模板中的占位符键名
  field_type: FieldType | string; // 字段类型
  is_required: boolean; // 是否必填
  default_value: string; // 默认值
  order: number;       // 排序顺序
  template_id: number; // 关联的模板ID
}

// 模板接口定义
interface Template {
  id: number;
  name: string;        // 模板名称
  category_id: number; // 分类ID
  description: string; // 模板描述
  content: string;     // 模板HTML内容
  is_active: boolean;  // 是否激活
  created_by: string;  // 创建者
  create_time: string; // 创建时间
  update_time: string; // 更新时间
  fields: TemplateField[]; // 模板包含的字段
}

// 表单数据接口
interface FormData {
  [key: string]: string; // 键是字段的field_key，值是用户输入的内容
}

// 创建axios实例
const api = axios.create({
  baseURL: "http://localhost:8084/v1",
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
  },
});

export default defineComponent({
  name: "TemplateRenderer",
  props: {
    templateId: {
      type: [Number, String] as PropType<number | string>,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
  },
  data() {
    return {
      template: null as Template | null,
      formData: {} as FormData,
      loading: false,
      error: null as string | null,
      showPreview: false,
    };
  },
  computed: {
    sortedFields(): TemplateField[] {
      // 按照order字段排序字段
      return this.template?.fields?.sort((a, b) => a.order - b.order) || [];
    },
    renderedContent(): string {
      if (!this.template) return "";

      // 替换模板中的占位符为表单数据
      let content = this.template.content;
      for (const key in this.formData) {
        const regex = new RegExp(`{{${key}}}`, "g");
        content = content.replace(regex, this.formData[key] || "___");
      }

      return content;
    },
  },
  created() {
    this.fetchTemplate();
  },
  methods: {
    fetchTemplate() {
      this.loading = true;
      this.error = null;

      // 从API获取模板数据
      api.get(`/templates/${this.templateId}`, {
        headers: {
          token: this.token,
        },
      })
          .then((response) => {
            this.template = response.data as Template;
            this.initFormData();
          })
          .catch((error) => {
            this.error =
                "获取模板数据失败：" +
                (error.response?.data?.message || error.message);
          })
          .finally(() => {
            this.loading = false;
          });
    },

    initFormData() {
      // 初始化表单数据，使用字段的默认值
      if (!this.template || !this.template.fields) return;

      this.formData = {};
      this.template.fields.forEach((field) => {
        this.formData[field.field_key] = field.default_value || "";
      });
    },

    submitForm() {
      // 表单提交前验证
      const invalidFields = this.validateForm();
      if (invalidFields.length > 0) {
        this.error = `请填写以下必填字段: ${invalidFields.join(", ")}`;
        return;
      }

      // 这里可以添加保存协议的代码
      // axios.post('/api/agreements', {...})

      this.previewAgreement();
    },

    validateForm(): string[] {
      // 验证表单，返回未填写的必填字段名称列表
      const invalidFields: string[] = [];

      if (!this.template || !this.template.fields) return invalidFields;

      this.template.fields.forEach((field) => {
        if (field.is_required === true) {
          const value = this.formData[field.field_key];
          if (value === undefined || value === null || value === "") {
            invalidFields.push(field.field_name);
          }
        }
      });

      return invalidFields;
    },

    previewAgreement() {
      // 预览协议前验证表单
      const invalidFields = this.validateForm();
      if (invalidFields.length > 0) {
        this.error = `请填写以下必填字段: ${invalidFields.join(", ")}`;
        return;
      }

      this.showPreview = true;
    },

    downloadAgreement() {
      // 下载协议为HTML文件
      if (!this.template) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="ch">
          <head>
            <meta charset="utf-8">
            <title>${this.template.name}</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .header { text-align: center; margin-bottom: 20px; }
              .content { margin: 0 auto; max-width: 800px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${this.template.name}</h1>
            </div>
            <div class="content">
              ${this.renderedContent}
            </div>
          </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${this.template.name}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  },
});
</script>


<style scoped>
.template-container {
    width: 100%;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
}

.description {
    color: #666;
    margin-bottom: 20px;
}

.form-field {
    margin-bottom: 20px;
}

.field-label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.required {
    color: red;
}

.field-input {
    width: 100%;
}

.field-input input,
.field-input select,
.field-input textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;
}

.field-input textarea {
    min-height: 100px;
}

.form-actions {
    margin-top: 30px;
    display: flex;
    gap: 10px;
}

.btn-submit,
.btn-preview,
.btn-close,
.btn-download {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
}

.btn-submit {
    background-color: #4caf50;
    color: white;
}

.btn-preview {
    background-color: #2196f3;
    color: white;
}

.preview-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.preview-content {
    background-color: white;
    padding: 30px;
    border-radius: 8px;
    width: 90%;
    max-width: 1200px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    margin: 0 auto;
}

.preview-text {
    margin: 20px 0;
    line-height: 1.6;
}

.preview-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

.btn-close {
    background-color: #f44336;
    color: white;
}

.btn-download {
    background-color: #ff9800;
    color: white;
}

.loading {
    text-align: center;
    padding: 20px;
    font-style: italic;
    color: #666;
}

.error-message {
    background-color: #ffebee;
    color: #c62828;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 20px;
}
</style>
