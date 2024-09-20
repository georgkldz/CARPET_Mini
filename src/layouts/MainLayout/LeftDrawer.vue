<template>
  <q-drawer
    v-model="applicationStore.leftDrawerOpen"
    side="left"
    overlay
    elevated
  >
    <div class="q-pa-md" style="max-width: 350px">
      <q-list bordered class="rounded-borders">
        <q-expansion-item
          expand-separator
          icon="settings"
          label="Settings"
          default-closed
        >
        </q-expansion-item>

        <q-expansion-item
          :content-inset-level="0.5"
          expand-separator
          icon="task"
          label="Übungsaufgaben"
          default-opened
        >
          <q-list bordered separator>
            <q-item
              clickable
              v-ripple
              v-for="[taskName] of Object.entries(applicationStore.tasks)"
              :key="taskName"
            >
              <router-link :to="`/task/${taskName}`">{{
                taskName
              }}</router-link>
            </q-item>
          </q-list>
        </q-expansion-item>
      </q-list>
    </div>
  </q-drawer>
</template>

<script lang="ts" setup>
import { useApplicationStore } from "src/stores/applicationStore";

const applicationStore = useApplicationStore();
</script>

<style></style>
