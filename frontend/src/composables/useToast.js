import { ref } from 'vue'

const toasts = ref([])

export function useToast() {
    function add(message, type = 'info', duration = 3000) {
        const id = Date.now() + Math.random()
        toasts.value.push({ id, message, type })

        if (duration > 0) {
            setTimeout(() => {
                remove(id)
            }, duration)
        }
    }

    function success(message, duration = 3000) {
        add(message, 'success', duration)
    }

    function error(message, duration = 4000) {
        add(message, 'error', duration)
    }

    function info(message, duration = 3000) {
        add(message, 'info', duration)
    }

    function warning(message, duration = 3500) {
        add(message, 'warning', duration)
    }

    function remove(id) {
        const index = toasts.value.findIndex(t => t.id === id)
        if (index !== -1) {
            toasts.value.splice(index, 1)
        }
    }

    return {
        toasts,
        add,
        remove,
        success,
        error,
        info,
        warning
    }
}
