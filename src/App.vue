<template>
  <MainLayout> </MainLayout>
</template>

<script setup lang="ts">
import MainLayout from "./layouts/MainLayout/MainLayout.vue";
import "@vue-flow/core/dist/style.css";

import "carpet-component-library/style.css";

defineOptions({
  name: "App",
});
</script>

<style>
html,
body,
#app {
  margin: 0;
  height: 100%;
  width: 100%;
}

#app {
  text-transform: uppercase;
  font-family: "JetBrains Mono", monospace;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

a {
  color: inherit;
  text-decoration: none;
}
</style>
