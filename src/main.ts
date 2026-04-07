import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './assets/main.css'

const pinia = createPinia()

const router = createRouter({
  history: createWebHistory(),
  routes: [],
})

createApp(App).use(pinia).use(router).mount('#app')
