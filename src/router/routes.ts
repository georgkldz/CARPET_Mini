import { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    redirect: "/login"
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("pages/Login/LoginScreen.vue")
  },
  {
    path: "/student-selection",
    name: "StudentSelection",
    component: () => import("pages/Login/StudentSelection.vue"),
  },
  {
    path: "/teacher-selection",
    name: "TeacherSelection",
    component: () => import("pages/Login/TeacherSelection.vue"),
  },
  {
    path: "/create-task",
    name: "CreateTask",
    component: () => import("pages/TeacherNewTask.vue"),
  },
  {
    path: "/main-layout",
    name: "MainLayout",
    component: () => import("layouts/MainLayout/MainLayout.vue"),
  },

  {
    path: "/task/:taskName",
    name: "Task",

    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () =>
      import(/* webpackChunkName: "task" */ "pages/TaskPage.vue"),
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: "/:catchAll(.*)*",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
