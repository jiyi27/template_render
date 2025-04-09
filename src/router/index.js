import { createRouter, createWebHistory } from "vue-router";
import TemplatePage from "../views/TemplatePage.vue";
import HomePage from "../views/HomePage.vue";

const routes = [
    {
        path: "/templates/:id",
        name: "Template",
        component: TemplatePage,
        props: true,
    },
    {
        path: "/",
        name: "Home",
        component: HomePage,
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
