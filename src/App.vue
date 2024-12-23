<template>
  <div>
    <!-- Bedingte Anzeige: LoginScreen oder MainLayout -->
    <LoginScreen v-if="!appStore.isAuthenticated" />
    <MainLayout v-else />

  </div>
</template>

<script setup lang="ts">
import { useApplicationStore } from "stores/applicationStore.ts";
import MainLayout from "layouts/MainLayout/MainLayout.vue";
import LoginScreen from "components/Login/LoginScreen.vue";

import "@vue-flow/core/dist/style.css";
import "carpet-component-library/style.css";

defineOptions({
  name: "App",
});
const appStore = useApplicationStore();
</script>

<style>
/* Bestehendes Styling bleibt unverändert */
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
.toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  opacity: 0.95;
  z-index: 9999;  /* Erhöht den z-index */
  transition: opacity 0.3s ease-in-out;
}

</style>
