<script setup>
import { RouterView } from 'vue-router'
import ToastNotification from './components/common/ToastNotification.vue'
import ConfirmationModal from './components/common/ConfirmationModal.vue'
import { useConfirm } from './composables/useConfirm'

const { state, handleConfirm, handleCancel } = useConfirm()
</script>

<template>
  <ToastNotification />
  <ConfirmationModal 
    :isOpen="state.isOpen"
    :title="state.title"
    :message="state.message"
    :type="state.type"
    :confirmText="state.confirmText"
    :cancelText="state.cancelText"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
  <RouterView />
</template>

<style>
/* Global app styles if needed */
</style>
