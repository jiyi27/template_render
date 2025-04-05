import { createRouter, createWebHistory } from "vue-router";
import TemplatePage from "../views/TemplatePage.vue";

const routes = [
    {
        path: "/templates/:id",
        name: "Template",
        component: TemplatePage,
        props: true,
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
