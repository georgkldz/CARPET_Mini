<template>
  <q-layout view="hHh lpR fFf">
    <MainHeader> </MainHeader>

    <LeftDrawer> </LeftDrawer>

    <q-page-container class="contentFrame">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import LeftDrawer from "./LeftDrawer.vue";
import MainHeader from "./MainHeader.vue";
</script>

<style>
.contentFrame {
  width: 100%;
  height: 100%;
}
</style>
