<template>
  <div>
   <router-view/>

  </div>
</template>

<script setup lang="ts">


import "@vue-flow/core/dist/style.css";
import "carpet-component-library/style.css";

defineOptions({
  name: "App",
});
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

.form__elements {
  align-items: flex-start ;
  width: 100%;
}

</style>
