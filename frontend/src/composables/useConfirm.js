import { ref } from 'vue'

const state = ref({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // info, warning, danger
    confirmText: 'Confirm',
    cancelText: 'Cancel'
})

let resolvePromise = null

export function useConfirm() {
    function confirm(options) {
        state.value = {
            isOpen: true,
            title: options.title || 'Confirm Action',
            message: options.message || 'Are you sure?',
            type: options.type || 'info',
            confirmText: options.confirmText || 'Confirm',
            cancelText: options.cancelText || 'Cancel'
        }

        return new Promise((resolve) => {
            resolvePromise = resolve
        })
    }

    function handleConfirm() {
        state.value.isOpen = false
        if (resolvePromise) {
            resolvePromise(true)
            resolvePromise = null
        }
    }

    function handleCancel() {
        state.value.isOpen = false
        if (resolvePromise) {
            resolvePromise(false)
            resolvePromise = null
        }
    }

    return {
        state,
        confirm,
        handleConfirm,
        handleCancel
    }
}
