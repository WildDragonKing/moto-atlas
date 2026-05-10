import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

const target = document.getElementById('app')
// Loading-Placeholder aus index.html entfernen (statisches HTML, kein User-Input).
while (target.firstChild) target.removeChild(target.firstChild)
const app = mount(App, { target })

export default app
