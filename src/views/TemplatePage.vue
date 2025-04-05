<template>
    <div class="template-page">
        <TemplateRenderer :templateId="$route.params.id" :token="token" />
    </div>
</template>

<script>
import TemplateRenderer from "../components/TemplateRenderer.vue";

export default {
    name: "TemplatePage",
    components: {
        TemplateRenderer,
    },
    data() {
        return {
            token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJuaWNrbmFtZSI6IkpvaG4iLCJyb2xlX2lkIjoxfQ.NFkENyI182Q3XPcGiTOCXWN21ZQoDP40SRGHYQ25vVw",
        };
    },
};
</script>

<style scoped>
.template-page {
    padding: 20px;
    width: 80%;
    max-width: 1400px;
    margin: 0 auto;
}
</style>
