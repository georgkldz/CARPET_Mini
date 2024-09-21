<template>
  <q-layout class="mainLayout" view="hHh lpR fFf">
    <MainHeader> </MainHeader>

    <LeftDrawer> </LeftDrawer>

    <q-page-container>
      <q-page>
        <router-view />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script lang="ts" setup>
import LeftDrawer from "./LeftDrawer.vue";
import MainHeader from "./MainHeader.vue";
</script>

<style></style>
