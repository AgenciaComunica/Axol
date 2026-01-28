import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue'),
    },
    {
      path: '/viewer-3d',
      name: 'viewer-3d',
      component: () => import('../views/Viewer3DView.vue'),
    },
  ],
})

export default router
