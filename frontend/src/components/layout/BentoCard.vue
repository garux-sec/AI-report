<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  },
  value: {
    type: [String, Number],
    default: ''
  },
  variant: {
    type: String,
    default: '', // '', 'highlight', 'success', 'warning', 'danger'
    validator: (v) => ['', 'highlight', 'success', 'warning', 'danger'].includes(v)
  },
  span: {
    type: Number,
    default: 1,
    validator: (v) => [1, 2, 3, 4].includes(v)
  },
  row: {
    type: Number,
    default: 1,
    validator: (v) => [1, 2, 3].includes(v)
  }
})
</script>

<template>
  <div 
    class="bento-card"
    :class="[
      variant ? variant : '',
      `bento-span-${span}`,
      `bento-row-${row}`
    ]"
  >
    <div v-if="title" class="bento-card-header">
      <h3 class="bento-card-title">{{ title }}</h3>
      <slot name="header-actions"></slot>
    </div>
    
    <div v-if="value" class="bento-card-value">
      {{ value }}
    </div>
    
    <slot></slot>
  </div>
</template>
