<script setup lang="ts">
import { twMerge } from 'tailwind-merge'

const aaa = twMerge('px-2 py-1 bg-red hover:bg-dark-red', 'p-3 bg-[#B91C1C]')

</script>

<template>
  <main class="flex min-h-screen flex-col items-center justify-between p-24 " :class="['before:text-[#123456]']">
    <nav :class="aaa">aaa</nav>
  </main>
</template>

<script lang="ts">
import { onMounted, defineComponent } from 'vue'

export default defineComponent({
  setup() {
    onMounted(() => {
      const clipPath = '';
      document.documentElement.animate(
        {
          clipPath
        },
        {
          duration: 500,
          easing: /* tw-mangle ignore */ 'ease-out',
          pseudoElement: '::view-transition-new(root)'
        })
      document.documentElement.animate(
        {
          clipPath
        },
        {
          duration: 500,
          easing: 'ease-out',
          pseudoElement: '::view-transition-new(root)'
        }
      )
    })
    return {}
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
