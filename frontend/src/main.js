import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Styles
import './styles/variables.css'
import './styles/base.css'
import './styles/bento.css'
import './styles/components.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
