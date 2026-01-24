<script setup>
import { useToast } from '../../composables/useToast'

const { toasts, remove } = useToast()
</script>

<template>
  <div class="toast-container">
    <transition-group name="toast">
      <div 
        v-for="toast in toasts" 
        :key="toast.id" 
        class="toast-alert"
        :class="toast.type"
        @click="remove(toast.id)"
      >
        <div class="toast-icon">
          <span v-if="toast.type === 'success'">✅</span>
          <span v-else-if="toast.type === 'error'">❌</span>
          <span v-else-if="toast.type === 'warning'">⚠️</span>
          <span v-else>ℹ️</span>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  pointer-events: none;
}

.toast-alert {
  pointer-events: auto;
  min-width: 300px;
  max-width: 400px;
  background: rgba(30, 41, 59, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem 1.25rem;
  border-radius: 12px;
  color: white;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.2s;
  border-left: 4px solid var(--border-color, #6366f1);
}

.toast-alert:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.toast-icon {
  font-size: 1.25rem;
}

.toast-message {
  font-size: 0.95rem;
  line-height: 1.4;
  font-weight: 500;
}

/* Variants */
.toast-alert.success {
  --border-color: #10b981;
  background: rgba(6, 78, 59, 0.85);
}

.toast-alert.error {
  --border-color: #ef4444;
  background: rgba(127, 29, 29, 0.85);
}

.toast-alert.warning {
  --border-color: #f59e0b;
  background: rgba(120, 53, 15, 0.85);
}

.toast-alert.info {
  --border-color: #3b82f6;
  background: rgba(30, 58, 138, 0.85);
}

/* Animations */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.5, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
