## 1. 协议表重构

> 背景: 模板是用来创建协议的, 协议就像合同 有 甲方 乙方 客户名 协议内容 等等信息, 但是呢不同的类型客户可能需要不同类型的合同协议格式, 所以才会有很多协议模板, 就像我们写简历的时候也会有不同的模板, 创建简历一般不会选个空白文档开始自己写, 而是选个自己喜欢的模板开始写, 协议模板大概也是这个意思

协议由模板来创建, 那协议的字段是不确定的, 因为不同模板有不同字段, 但是协议也有一些共同的字段:

- id(PK)
- 协议编号
- 协议名称
- 客户名称
- 签订时间
- 状态 
- 等等

考虑到用户有编辑协议的需求, 也就是编辑草稿单, 而草稿单是根据协议模板创建的, 所以协议也要额外存储存储协议模板里的其他字段(除了上面必须有的字段), 且当前端加载草稿单的时候要保证返回的数据 各个字段对应的值 可以被前端正确解析, 所以直接添加两个字段 template_id, template_values, 其中 values 为 JSON 格式, 用于存储非公共字段, 最后协议表结构:

```sql
-- 最终协议表定义
CREATE TABLE `agreement` (
  `id` INT(11) NOT NULL AUTO_INCREMENT COMMENT '主键，自增',
  `agreement_no` VARCHAR(20) NOT NULL COMMENT '协议编号，格式如20250210ABC0001',
  `agreement_name` VARCHAR(100) DEFAULT NULL COMMENT '协议名称，如xxxx旅行社协议',
  `agreement_type` VARCHAR(50) DEFAULT NULL COMMENT '协议类型',
  `customer_name` VARCHAR(100) DEFAULT NULL COMMENT '客户名称，如xxxx公司',
  `customer_type` VARCHAR(20) DEFAULT NULL COMMENT '客户类型',
  `template_id` INT(11) NOT NULL COMMENT '协议模板id',
  `template_values` JSON DEFAULT NULL COMMENT '协议模板特有字段', 
  `sign_date` DATE DEFAULT NULL COMMENT '签订时间',
  `agreement_file` VARCHAR(255) DEFAULT NULL COMMENT '协议文件路径',
  `is_offline` TINYINT(1) DEFAULT NULL COMMENT '是否为离线上传',
  `status` INT(11) NOT NULL DEFAULT 1 COMMENT '协议状态：1-草稿单, 2-待审批, 3-审批同意, 4-审批拒绝, 5-已删除, 6-已取消',
  `applicant_name` VARCHAR(50) DEFAULT NULL COMMENT '申请人姓名',
  `applicant_id` INT(11) DEFAULT NULL COMMENT '申请人ID',
  `application_date` DATETIME DEFAULT NULL COMMENT '申请日期',
  `delete_time` DATETIME DEFAULT NULL COMMENT '删除时间',
  `create_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_agreement_no` (`agreement_no`),
  KEY `idx_status` (`status`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='协议表';
```

> 协议的状态, 审批人等逻辑不变, 因为这里我们只是增加一些无关字段, 关于协议审批表的定义和逻辑可以参考 `017-协议 价格政策数据库表定义` 文档, 注意不要把协议模板id设置为外键且级连删除, 这样的话如果不小心删除了某个协议模板, 所有的协议都会被删除, 很危险

### 1.1. 前端如何打包数据

当前端客户提交创建协议的时候, 由前端负责对数据进行格式化, 即: 把协议公共字段单独处理, 然后非公共字段(模板特有字段) 打包到 请求体 values 字段中, 具体方式可参考:

```javascript
function submitAgreement(formData) {
  // 在这里添加基本字段
  const basicFields = {
    agreementName: formData.agreementName,
    agreementType: formData.agreementType,
    customerName: formData.customerName,
    customerType: formData.customerType,
    signDate: formData.signDate,
    // 其他基本字段...
  };
  
  // 单独打包模板特有字段
  const templateValues = {};
  
  // 假设 formData.fields 包含所有字段
  for (const key in formData.fields) {
    if (!Object.keys(basicFields).includes(key)) {
      templateValues[key] = formData.fields[key];
    }
  }
  
  // 发送到后端
  return api.post('/agreements', {
    ...basicFields,
    template_id: formData.templateId,
    template_values: templateValues
  });
}
```

### 1.2. 后端返回的数据格式

先插入测试数据, 插入模板数据, 复制下面的 json 数据到 swagger 文档, 找到 POST /v1/templates, 进行创建模板 (注意前提是 此时已经有模板类别 id 为 1 的记录了, 也就是说你得先插入模板类别数据, 文档后面我给出了如何上传模板类别的方法):

```json
{
  "name": "旅游服务协议模板",
  "category_id": 1,
  "description": "适用于旅行社与客户签订的标准旅游服务协议",
  "content": "<h1>{{agreement_name}}</h1>\n\n<p><strong>甲方（服务方）：</strong>ABC旅行社</p>\n<p><strong>乙方（客户方）：</strong>{{customer_name}}</p>\n\n<p><strong>客户类型：</strong>{{customer_type}}</p>\n<p><strong>协议类型：</strong>{{agreement_type}}</p>\n\n<h2>一、服务内容</h2>\n<p>1. 旅游目的地：{{destination}}</p>\n<p>2. 行程天数：{{travel_days}}天</p>\n<p>3. 出发日期：{{start_date}}</p>\n<p>4. 返回日期：{{end_date}}</p>\n<p>5. 出行人数：{{people_count}}人</p>\n\n<h2>二、签订日期</h2>\n<p>{{sign_date}}</p>",
  "is_active": true,
  "fields": [
    {
      "field_name": "协议名称",
      "field_key": "agreement_name",
      "field_type": "text",
      "is_required": true,
      "default_value": "",
      "order": 1
    },
    {
      "field_name": "客户名称",
      "field_key": "customer_name",
      "field_type": "text",
      "is_required": true,
      "default_value": "",
      "order": 2
    },
    {
      "field_name": "客户类型",
      "field_key": "customer_type",
      "field_type": "dropdown",
      "is_required": true,
      "default_value": "个人客户",
      "order": 3
    },
    {
      "field_name": "协议类型",
      "field_key": "agreement_type",
      "field_type": "text",
      "is_required": true,
      "default_value": "旅游服务协议",
      "order": 4
    },
    {
      "field_name": "签订日期",
      "field_key": "sign_date",
      "field_type": "date",
      "is_required": true,
      "default_value": "",
      "order": 5
    },
    {
      "field_name": "目的地",
      "field_key": "destination",
      "field_type": "text",
      "is_required": true,
      "default_value": "",
      "order": 6
    },
    {
      "field_name": "行程天数",
      "field_key": "travel_days",
      "field_type": "number",
      "is_required": true,
      "default_value": "5",
      "order": 7
    },
    {
      "field_name": "出发日期",
      "field_key": "start_date",
      "field_type": "date",
      "is_required": true,
      "default_value": "",
      "order": 8
    },
    {
      "field_name": "返回日期",
      "field_key": "end_date",
      "field_type": "date",
      "is_required": true,
      "default_value": "",
      "order": 9
    },
    {
      "field_name": "出行人数",
      "field_key": "people_count",
      "field_type": "number",
      "is_required": true,
      "default_value": "1",
      "order": 10
    }
  ]
}
```

然后上传协议, 找到 POST /v1/agreements/drafts, 然后填入数据 (注意下面 `template_id` 我填的 10, 你应该改成上面刚创建的模板的 id):

```json
{
  "agreement_name": "张三日本东京五日游服务协议",
  "customer_name": "张三",
  "agreement_type": "旅游服务协议",
  "customer_type": "个人客户",
  "agreement_file": "",
  "sign_date": "2025-04-05",
  "template_id": 10,
  "template_values": {
    "agreement_name": "张三日本东京五日游服务协议",
    "customer_name": "张三",
    "agreement_type": "旅游服务协议",
    "customer_type": "个人客户",
    "sign_date": "2025-04-05",
    "destination": "日本东京",
    "travel_days": "5",
    "start_date": "2025-05-01",
    "end_date": "2025-05-05",
    "people_count": "2"
  }
}
```

然后到 GET   /v1/agreements/load/{agreement_id} 获取具体信息:

```json
{
  "code": 200,
  "msg": "获取协议成功",
  "data": {
    "agreement_name": "张三日本东京五日游服务协议",
    "agreement_type": "旅游服务协议",
    "customer_name": "张三",
    "customer_type": "个人客户",
    "sign_date": "2025-04-05T00:00:00",
    "template_id": 10,
    "template_values": {
      "end_date": "2025-05-05",
      "sign_date": "2025-04-05",
      "start_date": "2025-05-01",
      "destination": "日本东京",
      ...
    },
    "template": {
      "name": "旅游服务协议模板",
      "category_id": null,
      "description": "适用于旅行社与客户签订的标准旅游服务协议",
      "content": "<h1>{{agreement_name}}</h1>\n\n<p><strong>甲方（服务方）：</strong>ABC旅行社</p>\n<p><strong>乙方（客户方）：</strong>{{customer_name}}</p>\n\n<p><strong>客户类型：</strong>{{customer_type}}</p>\n<p><strong>协议类型：</strong>{{agreement_type}}</p>\n\n<h2>一、服务内容</h2>\n<p>1. 旅游目的地：{{destination}}</p>\n<p>2. 行程天数：{{travel_days}}天</p>\n<p>3. 出发日期：{{start_date}}</p>\n<p>4. 返回日期：{{end_date}}</p>\n<p>5. 出行人数：{{people_count}}人</p>\n\n<h2>二、签订日期</h2>\n<p>{{sign_date}}</p>",
      "is_active": true,
      "id": null,
      "created_by": null,
      "create_time": null,
      "update_time": null,
      "fields": [
        {
          "field_name": "协议名称",
          "field_key": "agreement_name",
          "field_type": "text",
          "is_required": true,
          "default_value": "",
          "order": 1,
          "id": null,
          "template_id": null
        },
        {
          "field_name": "客户名称",
          "field_key": "customer_name",
          "field_type": "text",
          "is_required": true,
          "default_value": "",
          "order": 2,
          "id": null,
          "template_id": null
        },
        ....
      ]
    }
  }
}
```

### 1.3. 前端如何解析后端返回的数据

解析数据的主要难点在于如何正确加载所有的数据, 后端已经给出了全部你需要的数据, 首先后端给出了该协议使用的模板的所有的信息, 在这里前端只需要两个信息:模板的 content 和 fields, fields 包含了该协议的所有字段:

- 公共字段
- 模板特有字段

除此之外每个字段的排序也都包含在内了, 所以渲染协议逻辑和最开始的渲染协议模板逻辑几乎一模一样, 唯一的区别就是, 我们需要把后端传来的对应字段的数据分别加载到对应的 field, 这里后端可以保证的一项是: 所有协议对应的值 的 key 都是和模板的每个 field 的 field_key 相同的, 所以把协议的各个字段对应的值, 插入到 模板对应的 field, 应该不是很难, 

比如模板的 fields 为:

```json
[
  {
    "field_name": "协议名称",
    "field_key": "agreement_name",
    "field_type": "text",
    "is_required": true,
    "default_value": "",
    "order": 1,
    "id": null,
    "template_id": null
  },
  {
    "field_name": "客户名称",
    "field_key": "customer_name",
    "field_type": "text",
    "is_required": true,
    "default_value": "",
    "order": 2,
    "id": null,
    "template_id": null
  }]
```

那协议就一定存在 `"agreement_name": "张三日本东京五日游服务协议",`, `"agreement_type": "旅游服务协议"`, 只不过对应的值可能为空, 因为协议可能是草稿单, 用户有很多区域并没有填写, 当对应的值为空时, 就展示 field 对应的默认值就行了, 下面是解析渲染数据的核心部分, 至于完整逻辑可以参考渲染模板的逻辑, 这里不提供赘述:

```js
initFormData() {
  // 重置表单数据
  this.formData = {};
  
  if (!this.agreement || !this.agreement.template || !this.agreement.template.fields) {
    return;
  }
  
  // 遍历所有模板字段
  this.agreement.template.fields.forEach(field => {
    const fieldKey = field.field_key;
    
    // 优先使用协议中已有的值
    if (this.agreement.template_values && 
        this.agreement.template_values[fieldKey] !== undefined && 
        this.agreement.template_values[fieldKey] !== null && 
        this.agreement.template_values[fieldKey] !== '') {
      this.formData[fieldKey] = this.agreement.template_values[fieldKey];
    } 
    // 对于公共字段，也可能存储在协议的顶层属性中
    else if (this.agreement[fieldKey] !== undefined && 
            this.agreement[fieldKey] !== null && 
            this.agreement[fieldKey] !== '') {
      this.formData[fieldKey] = this.agreement[fieldKey];
    }
    // 如果没有值，则使用默认值
    else {
      this.formData[fieldKey] = field.default_value || '';
    }
  });
}
```

字段显示需要排序, 排序逻辑:

```js
sortedFields() {
  if (!this.agreement || !this.agreement.template || !this.agreement.template.fields) {
    return [];
  }
  
  return [...this.agreement.template.fields].sort((a, b) => a.order - b.order);
}
```

表单渲染:

```js
<div 
  v-for="field in sortedFields" 
  :key="field.id" 
  class="form-field"
>
  <label :for="`field_${field.id}`" class="field-label">
    {{ field.field_name }}
    <span v-if="field.is_required" class="required">*</span>
  </label>
  
  <div class="field-input">
    <!-- 根据字段类型渲染不同的输入控件 -->
    <input
      v-if="field.field_type === 'text'"
      :id="`field_${field.id}`"
      v-model="formData[field.field_key]"
      type="text"
      class="input-text"
      :required="field.is_required"
      :placeholder="`请输入${field.field_name}`"
    />
    
    <!-- 其他类型的输入控件... -->
  </div>
</div>
```

加载协议:

```js
async loadAgreement() {
  try {
    const response = await axios.get(`/api/v1/agreements/${this.agreementId}`);
    this.agreement = response.data;
    this.initFormData();
    this.isLoaded = true;
  } catch (error) {
    this.error = `加载协议失败: ${error.message}`;
    console.error('加载协议失败:', error);
  }
}
```

## 2. 模板后端实现

### 2.1. 后端 数据库表

**模板类别表 (template_categories)**

```
id: 主键
name: 类别名称
description: 类别描述
created_at: 创建时间
updated_at: 更新时间
```

**模板表 (templates)**

```
id: 主键
name: 模板名称
category_id: 外键，关联模板类别
content: 模板内容（HTML或Markdown格式，包含占位符）
description: 模板描述
is_active: 是否启用
created_by: 创建者ID
created_at: 创建时间
updated_at: 更新时间
```

**模板字段表 (template_fields)**

```
id: 主键
template_id: 外键，关联模板
field_name: 字段名称（如"甲方"、"乙方"等）
field_key: 字段标识符（用于前端渲染和数据绑定）
field_type: 字段类型（文本、数字、日期等）
is_required: 是否必填
default_value: 默认值
order: 排序顺序
placeholder: 提示文本
```

> 为什么要有模板类别表 ?
>
> 我们的模板可能会很多, 比如 销售协议, A类型客户协议, B 类型客户协议, 什么打折促销协议等等, 如果没有一个分类, 可能客户查找起来不太方便

### 2.3. MySQL 建表语句

```sql
-- 模板类别表
CREATE TABLE `template_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL COMMENT '类别名称',
  `description` text COMMENT '类别描述',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模板类别表';

-- 模板表（包含内容）
CREATE TABLE `templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL COMMENT '模板名称',
  `category_id` int NOT NULL COMMENT '所属类别ID',
  `description` text COMMENT '模板描述',
  `content` longtext NOT NULL COMMENT '模板内容',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否启用',
  `created_by` int NOT NULL COMMENT '创建者ID',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category_id`),
  KEY `idx_name` (`name`),
  KEY `idx_active` (`is_active`),
  KEY `idx_create_time` (`create_time`)
  CONSTRAINT `fk_template_category` FOREIGN KEY (`category_id`) REFERENCES `template_categories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模板表';

-- 模板字段表
CREATE TABLE `template_fields` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_id` int NOT NULL COMMENT '所属模板ID',
  `field_name` varchar(100) NOT NULL COMMENT '字段名称',
  `field_key` varchar(100) NOT NULL COMMENT '字段标识符',
  `field_type` enum('text','number','date','dropdown','textarea') NOT NULL COMMENT '字段类型',
  `is_required` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否必填',
  `default_value` varchar(500) DEFAULT NULL COMMENT '默认值',
  `order` int NOT NULL DEFAULT '0' COMMENT '排序顺序',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `delete_time` datetime DEFAULT NULL COMMENT '删除时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_template_field_key` (`template_id`,`field_key`),
  KEY `idx_template` (`template_id`),
  CONSTRAINT `fk_field_template` FOREIGN KEY (`template_id`) REFERENCES `templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='模板字段表';
```

### 2.4. REST API 设计

```
# 获取所有模板类别
GET /api/categories

# 创建模板类别
POST /api/categories

# 更新模板类别
PUT /api/categories/{id}

# 删除模板类别
DELETE /api/categories/{id}
```

```
# 获取所有模板
GET /api/templates
# 可选查询参数: category_id, is_active, search

# 获取单个模板（包含字段）
GET /api/templates/{id}

# 创建模板
POST /api/templates

# 更新模板
PUT /api/templates/{id}

# 删除模板
DELETE /api/templates/{id}

# 复制模板
POST /api/templates/{id}/duplicate
```

```
# 获取模板的所有字段
GET /api/templates/{template_id}/fields

# 批量更新字段
PUT /api/templates/{template_id}/fields
```

### 2.6. 创建数据

**通过 swagger 文档**, 找到这两个 API:

```
POST /v1/categories
POST /v1/templates
```

分别输入下面格式的数据进行创建模板, 先创建几个模板类别 (下面的数据只是用于测试, 可以根据实际需求上传):

```json
{
  "name": "合同模板",
  "description": "各类法律合同文档模板，包括劳动合同、租赁合同、销售合同等"
}
```

```json
{
  "name": "协议模板",
  "description": "各类协议文档模板，包括保密协议、合作协议、服务协议等"
}
```

```json
{
  "name": "申请表格",
  "description": "各类申请表格模板，包括请假申请、报销申请、入职申请等"
}
```

然后上传模板文件 `POST /v1/templates`:

```json
{
  "name": "房屋租赁合同",
  "category_id": 1,
  "description": "标准房屋租赁合同模板，适用于个人或企业租房场景",
  "content": "<h2 style=\"text-align: center;\">房屋租赁合同</h2>\n\n<p><strong>出租方（甲方）：</strong>{{landlord_name}}</p>\n<p><strong>身份证号：</strong>{{landlord_id}}</p>\n<p><strong>承租方（乙方）：</strong>{{tenant_name}}</p>\n<p><strong>身份证号：</strong>{{tenant_id}}</p>\n\n<p>甲、乙双方就房屋租赁事宜，达成如下协议：</p>\n\n<h3>第一条 房屋基本情况</h3>\n<p>甲方将位于{{property_address}}的房屋出租给乙方使用。房屋面积为{{property_area}}平方米。</p>\n\n<h3>第二条 租赁期限</h3>\n<p>租赁期共{{lease_term}}个月，自{{start_date}}起至{{end_date}}止。</p>\n\n<h3>第三条 租金及付款方式</h3>\n<p>月租金为人民币{{monthly_rent}}元整。乙方应于每月{{payment_day}}日前向甲方支付当月租金。</p>\n\n<h3>第四条 押金</h3>\n<p>乙方应于签订本合同时向甲方支付押金人民币{{deposit}}元整。</p>\n\n<h3>第五条 双方权利与义务</h3>\n<p>{{rights_obligations}}</p>\n\n<h3>第六条 合同解除</h3>\n<p>{{termination_terms}}</p>\n\n<h3>第七条 其他约定</h3>\n<p>{{additional_terms}}</p>\n\n<p style=\"text-align: right;\">甲方（签字）：_____________ 日期：_____________</p>\n<p style=\"text-align: right;\">乙方（签字）：_____________ 日期：_____________</p>",
  "is_active": true,
  "fields": [
    {
      "field_name": "出租方姓名",
      "field_key": "landlord_name",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 1
    },
    {
      "field_name": "出租方身份证号",
      "field_key": "landlord_id",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 2
    },
    {
      "field_name": "承租方姓名",
      "field_key": "tenant_name",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 3
    },
    {
      "field_name": "承租方身份证号",
      "field_key": "tenant_id",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 4
    },
    {
      "field_name": "房屋地址",
      "field_key": "property_address",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 5
    },
    {
      "field_name": "房屋面积",
      "field_key": "property_area",
      "field_type": "number",
      "is_required": 1,
      "default_value": "",
      "order": 6
    },
    {
      "field_name": "租赁期限（月）",
      "field_key": "lease_term",
      "field_type": "number",
      "is_required": 1,
      "default_value": "12",
      "order": 7
    },
    {
      "field_name": "起租日期",
      "field_key": "start_date",
      "field_type": "date",
      "is_required": 1,
      "default_value": "",
      "order": 8
    },
    {
      "field_name": "到期日期",
      "field_key": "end_date",
      "field_type": "date",
      "is_required": 1,
      "default_value": "",
      "order": 9
    },
    {
      "field_name": "月租金（元）",
      "field_key": "monthly_rent",
      "field_type": "number",
      "is_required": 1,
      "default_value": "",
      "order": 10
    },
    {
      "field_name": "付款日",
      "field_key": "payment_day",
      "field_type": "number",
      "is_required": 1,
      "default_value": "5",
      "order": 11
    },
    {
      "field_name": "押金（元）",
      "field_key": "deposit",
      "field_type": "number",
      "is_required": 1,
      "default_value": "",
      "order": 12
    },
    {
      "field_name": "双方权利与义务",
      "field_key": "rights_obligations",
      "field_type": "textarea",
      "is_required": 1,
      "default_value": "1. 甲方保证所出租房屋的产权清晰，无产权纠纷。\n2. 甲方负责房屋的维修与保养。\n3. 乙方应按时支付租金，爱护房屋设施。\n4. 乙方不得擅自改变房屋结构或用途。",
      "order": 13
    },
    {
      "field_name": "合同解除条款",
      "field_key": "termination_terms",
      "field_type": "textarea",
      "is_required": 1,
      "default_value": "1. 任何一方提前解除合同，应提前30天通知对方。\n2. 乙方违反本合同约定，甲方有权解除合同并要求乙方赔偿损失。",
      "order": 14
    },
    {
      "field_name": "其他约定",
      "field_key": "additional_terms",
      "field_type": "textarea",
      "is_required": 0,
      "default_value": "",
      "order": 15
    }
  ]
}
```

```json
{
  "name": "费用报销申请表",
  "category_id": 3,
  "description": "员工费用报销申请表格，适用于各类报销场景",
  "content": "<h2 style=\"text-align: center;\">费用报销申请表</h2>\n\n<table border=\"1\" cellpadding=\"10\" cellspacing=\"0\" style=\"width: 100%; border-collapse: collapse;\">\n  <tr>\n    <td width=\"20%\"><strong>申请人</strong></td>\n    <td width=\"30%\">{{employee_name}}</td>\n    <td width=\"20%\"><strong>部门</strong></td>\n    <td width=\"30%\">{{department}}</td>\n  </tr>\n  <tr>\n    <td><strong>职位</strong></td>\n    <td>{{position}}</td>\n    <td><strong>申请日期</strong></td>\n    <td>{{application_date}}</td>\n  </tr>\n  <tr>\n    <td><strong>报销类型</strong></td>\n    <td colspan=\"3\">{{expense_type}}</td>\n  </tr>\n  <tr>\n    <td><strong>费用明细</strong></td>\n    <td colspan=\"3\">{{expense_details}}</td>\n  </tr>\n  <tr>\n    <td><strong>报销总金额</strong></td>\n    <td colspan=\"3\">¥{{total_amount}}</td>\n  </tr>\n  <tr>\n    <td><strong>报销事由</strong></td>\n    <td colspan=\"3\">{{expense_reason}}</td>\n  </tr>\n  <tr>\n    <td><strong>银行账户</strong></td>\n    <td colspan=\"3\">{{bank_account}}</td>\n  </tr>\n  <tr>\n    <td><strong>申请人签名</strong></td>\n    <td>{{employee_signature}}</td>\n    <td><strong>签名日期</strong></td>\n    <td>{{signature_date}}</td>\n  </tr>\n  <tr>\n    <td><strong>部门主管审批</strong></td>\n    <td colspan=\"3\">{{supervisor_approval}}</td>\n  </tr>\n  <tr>\n    <td><strong>财务部审核</strong></td>\n    <td colspan=\"3\">{{finance_approval}}</td>\n  </tr>\n  <tr>\n    <td><strong>备注</strong></td>\n    <td colspan=\"3\">{{remarks}}</td>\n  </tr>\n</table>",
  "is_active": true,
  "fields": [
    {
      "field_name": "申请人",
      "field_key": "employee_name",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 1
    },
    {
      "field_name": "部门",
      "field_key": "department",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 2
    },
    {
      "field_name": "职位",
      "field_key": "position",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 3
    },
    {
      "field_name": "申请日期",
      "field_key": "application_date",
      "field_type": "date",
      "is_required": 1,
      "default_value": "",
      "order": 4
    },
    {
      "field_name": "报销类型",
      "field_key": "expense_type",
      "field_type": "text",
      "is_required": 1,
      "default_value": "差旅费",
      "order": 5
    },
    {
      "field_name": "费用明细",
      "field_key": "expense_details",
      "field_type": "textarea",
      "is_required": 1,
      "default_value": "1. 交通费：¥\n2. 住宿费：¥\n3. 餐饮费：¥\n4. 其他费用：¥",
      "order": 6
    },
    {
      "field_name": "报销总金额",
      "field_key": "total_amount",
      "field_type": "number",
      "is_required": 1,
      "default_value": "",
      "order": 7
    },
    {
      "field_name": "报销事由",
      "field_key": "expense_reason",
      "field_type": "textarea",
      "is_required": 1,
      "default_value": "",
      "order": 8
    },
    {
      "field_name": "银行账户",
      "field_key": "bank_account",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 9
    },
    {
      "field_name": "申请人签名",
      "field_key": "employee_signature",
      "field_type": "text",
      "is_required": 1,
      "default_value": "",
      "order": 10
    },
    {
      "field_name": "签名日期",
      "field_key": "signature_date",
      "field_type": "date",
      "is_required": 1,
      "default_value": "",
      "order": 11
    },
    {
      "field_name": "部门主管审批",
      "field_key": "supervisor_approval",
      "field_type": "textarea",
      "is_required": 0,
      "default_value": "",
      "order": 12
    },
    {
      "field_name": "财务部审核",
      "field_key": "finance_approval",
      "field_type": "textarea",
      "is_required": 0,
      "default_value": "",
      "order": 13
    },
    {
      "field_name": "备注",
      "field_key": "remarks",
      "field_type": "textarea",
      "is_required": 0,
      "default_value": "",
      "order": 14
    }
  ]
}
```

## 3. 模板渲染前端实现

当前支持渲染的输入类型:

| Field Type | Input Element           | Description                                |
| ---------- | ----------------------- | ------------------------------------------ |
| text       | `⁠<input type="text">`   | Standard text input for short text entries |
| number     | `⁠<input type="number">` | Numeric input field                        |
| date       | ⁠`<input type="date">`   | Date picker input                          |
| textarea   | `⁠<textarea>`            | Multi-line text input for longer content   |

前端渲染页面需要使用的 REST API:

```
/templates/${templateId}
```

API 返回的数据格式:

```json
{
  "id": 1,
  "name": "租房合同",
  "description": "标准租房合同模板，适用于个人租房场景",
  "content": "<h2 style=\"text-align: center;\">房屋租赁合同</h2>\n\n<p><strong>出租方（甲方）：</strong>{{landlord_name}}</p>...",
  "fields": [
    {
      "id": 1,
      "field_name": "出租方姓名",
      "field_key": "landlord_name",
      "field_type": "text",
      "is_required": true,
      "default_value": "",
      "order": 1
    },
    // ... other fields
  ]
}
```

## 4. 前端运行

> 代码仓库: https://github.com/jiyi27/template_render

```shell
pnpm create vue@latest

cd your_project_file
pnpm install
pnpm run dev
```

根据你的 vue 配置访问页面, 如:

```
http://localhost:5173/templates/1

http://localhost:5173/templates/2
```

注意, 后端 fetch 数据的 url 我写在了 `TemplateRenderer.vue`, 可以根据项目需要修改

## 5. 待办

- [ ] 加载协议模板类别页面, 即客户选择创建协议, 然后应弹出选择模板页面, 该页面还未实现
- [x] 后端 API 都已经实现, 前端参考 后端 Swagger 文档, 直接 fetch 即可, 但是请告诉后端的小伙伴别忘了提前录入一些模板数据, 数据内容我已经放到了文档前面部分, 直接通过 CURL 上传即可
- [x] 模板渲染页面
- [x] 模板下载预览

