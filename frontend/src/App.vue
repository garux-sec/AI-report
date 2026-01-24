<script setup>
import { RouterView } from 'vue-router'
import ToastNotification from './components/common/ToastNotification.vue'
</script>

<template>
  <ToastNotification />
  <RouterView />
</template>

<style>
/* Global app styles if needed */
</style>
