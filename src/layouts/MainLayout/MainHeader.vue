<template>
  <q-header elevated class="bg-primary text-white">
    <q-toolbar>
      <q-btn
        dense
        flat
        round
        icon="menu"
        @click="applicationStore.toggleLeftDrawer"
      />

      <q-toolbar-title>
        <router-link to="/"> CARPET </router-link>
        <q-avatar>
          <img src="/magicCarpet.png" />
        </q-avatar>
      </q-toolbar-title>
    </q-toolbar>
  </q-header>
</template>

<script lang="ts" setup>
import { useApplicationStore } from "src/stores/applicationStore";

const applicationStore = useApplicationStore();
</script>

<style></style>
