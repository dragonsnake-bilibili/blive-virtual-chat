<template>
  <div style="text-align: center">无可配置内容</div>
</template>
<script setup lang="ts">
import type { ThemeSpecifiedConfiguration } from "../interface";
defineModel<ThemeSpecifiedConfiguration>({
  required: true,
});
</script>
