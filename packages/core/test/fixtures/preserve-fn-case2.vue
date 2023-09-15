<script setup lang="ts">
import { twMerge } from 'tailwind-merge'
// 'hover:bg-dark-red p-3 bg-[#B91C1C]'
const aaa = twMerge('px-2 py-1 bg-red-100 hover:bg-red-800', 'p-3 bg-[#B91C1C]')

</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-between p-24 bg-red-100">
    <nav :class="aaa">{{ aaa }}</nav>
  </main>
</template>

<script lang="ts">
import { onMounted, defineComponent } from 'vue'
import { twMerge } from 'tailwind-merge'

export default defineComponent({
  setup() {
    const bbb = twMerge('bg-red-100 hover:bg-red-100 lg:dark:bg-red-100', 'p-3 bg-[#B91C1C]')
    return {
      bbb
    }
  }
})

</script>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}

.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
