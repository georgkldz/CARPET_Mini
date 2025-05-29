<template>
  <q-banner dense class="bg-blue-grey-1 q-pa-sm flex items-center">
    <q-icon name="info" class="q-mr-sm" />
    <div>
      <div class="text-weight-bold">Du bist {{ myRole?.name ?? "…" }}</div>
      <div class="text-caption">{{ myRole?.description }}</div>
    </div>
  </q-banner>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCollaborationStore } from "stores/collaborationStore";

const collab = useCollaborationStore();
const myRole = computed(() => collab.roleInfos[collab.myCollabRoleId ?? -1]);
</script>

