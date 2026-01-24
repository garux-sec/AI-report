<script setup>
defineProps({
  isOpen: Boolean,
  title: String,
  message: String,
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  type: {
    type: String,
    default: 'info' // info, warning, danger
  }
})

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div v-if="isOpen" class="modal-backdrop" @click.self="emit('cancel')">
    <div class="modal confirm-modal" :class="type">
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="modal-close" @click="emit('cancel')">×</button>
      </div>
      
      <div class="modal-body">
        <p>{{ message }}</p>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('cancel')">
          {{ cancelText }}
        </button>
        <button class="btn" :class="type === 'danger' ? 'btn-danger' : 'btn-primary'" @click="emit('confirm')">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal {
  background: rgba(30, 41, 59, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 400px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
  animation: modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-muted);
  cursor: pointer;
}

.modal-body {
  padding: 1.5rem;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.5;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--glass-border);
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* Variants */
.confirm-modal.danger .modal-header h3 {
  color: #ef4444;
}

.confirm-modal.warning .modal-header h3 {
  color: #f59e0b;
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
