<template>
  <div class="flex q-gutter-sm">
    <div
      v-for="m in members"
      :key="m.userId"
      class="avatar q-pa-xs rounded-borders"
      :style="{ backgroundColor: roleInfo(m.collabRoleId).colorHex }"
    >
      <q-icon name="person" size="20px" />
      <q-tooltip>
        <strong>{{ roleInfo(m.collabRoleId).name }}</strong><br>
        {{ roleInfo(m.collabRoleId).description }}
      </q-tooltip>
      <div class="text-caption">{{ nick(m.userId) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCollaborationStore } from "stores/collaborationStore";

const collab      = useCollaborationStore();
const members     = computed(() => collab.group?.members ?? []);
const roleInfo    = (r: number) => collab.roleInfos[r] ?? {};

// Holt Nickname aus dem Group-Array; Fallback auf "User X"
function nick(uid: number) {
  return collab.group?.members.find(m => m.userId === uid)?.nickname
    ?? `User ${uid}`;
}
</script>

<style scoped>
.avatar {
  color: #000;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  cursor: default;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 8px;
  display: inline-block;
}

.avatar:hover {
  transform: scale(1.05);
  transition: transform 0.2s ease-in-out;
}
.rounded-borders { border-radius: 8px; }
</style>
