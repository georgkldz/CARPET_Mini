<template>
  <div class="loadingLayer">
    <img class="loadingSpinner" src="/img/loading_spinner.svg" />
  </div>
</template>

<script lang="ts" setup></script>

<style scoped>
.loadingLayer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100vh;
}

.loadingSpinner {
  width: 10vw;
  height: 10vw;
}
</style>
