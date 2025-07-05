<template>
  <q-card class="comment-list-card">
    <q-card-section>
      <div class="text-h6">Kommentare</div>
    </q-card-section>

    <q-card-section class="q-pt-none">
      <q-list bordered dense>
        <!-- Wenn keine Kommentare vorhanden -->
        <q-item v-if="!grouped.length">
          <q-item-section>
            <div class="text-grey">
              Noch keine Kommentare vorhanden. Klicken Sie auf ein Formularfeld, um einen Kommentar hinzuzufügen.
            </div>
          </q-item-section>
        </q-item>

        <!-- Kommentare gruppiert nach Feldern -->
        <q-expansion-item
          v-for="({ fieldId, comments }, idx) in grouped"
          :key="`${fieldId}-${idx}`"
          v-model="open[fieldId]"
          @mouseenter="emit('highlightField', fieldId)"
          @mouseleave="emit('highlightField', null)"
          dense
        >
          <template #header>
            <div class="row items-center no-wrap full-width">
              <span class="text-bold">{{ fieldId }}</span>
              <q-space />
              <div class="comment-count-badge">
                <q-icon name="chat_bubble_outline" size="24px" color="primary" />
                <span class="comment-count">{{ comments.length }}</span>
              </div>
            </div>
          </template>>

          <!-- Kommentare für dieses Feld -->
          <q-item
            v-for="comment in comments"
            :key="comment.id"
            dense
          >
            <q-item-section>
              <div>{{ comment.text }}</div>
              <div class="text-caption text-grey">
                {{ formatDate(comment.timestamp) }} |
                {{ commentStore.getFormattedNicknameByUserId(comment.userId)}}
              </div>
            </q-item-section>
          </q-item>
        </q-expansion-item>

        <!-- Neuer Kommentar-Bereich -->
        <q-item v-if="props.selectedFieldId">
          <q-item-section>
            <div class="text-bold q-mb-sm">
              Neuer Kommentar für: {{ props.selectedFieldId }}
            </div>
            <q-input
              v-model="newText"
              type="textarea"
              outlined
              dense
              placeholder="Kommentar eingeben..."
              @keyup.enter.stop="saveComment"
            />
            <div class="q-mt-sm">
              <q-btn
                color="primary"
                label="Kommentar speichern"
                :disable="!newText.trim()"
                @click="saveComment"
              />
              <q-btn
                flat
                label="Abbrechen"
                class="q-ml-sm"
                @click="emit('selectField', '')"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useCommentStore } from "src/stores/commentStore";
import { useTaskGraphStore } from "src/stores/taskGraphStore";


interface Props {
  sessionId: number;
  selectedFieldId: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "highlightField", fieldId: string | null): void;
  (e: "selectField", fieldId: string): void;
}>();

const commentStore = useCommentStore();
const taskGraphStore = useTaskGraphStore();
const open = ref<Record<string, boolean>>({});
const newText = ref("");


function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getFieldLabel(fieldId: string): string {
  const label = taskGraphStore.getProperty(
    `$.nodes.${taskGraphStore.currentNode}.components.0.nestedComponents.formComponents.${fieldId}.name`
  ) as string;
  return label || fieldId;
}

// Kommentare gruppieren
const grouped = computed(() => {
  const list = commentStore.visibleCommentsForSession;
  const map: Record<string, {
    fieldId: string;
    label: string;
    comments: typeof list
  }> = {};

  list.forEach(c => {
    if (!map[c.fieldId]) {
      map[c.fieldId] = {
        fieldId: c.fieldId,
        label: getFieldLabel(c.fieldId),
        comments: []
      };
    }
    map[c.fieldId].comments.push(c);
  });

  return Object.values(map);
});

// Kommentar speichern
async function saveComment(): Promise<void> {
  if (!props.selectedFieldId || !newText.value.trim()) return;

  const userId = taskGraphStore.userId ?? 0;

  await commentStore.addComment({
    sessionId: props.sessionId,
    fieldId: props.selectedFieldId,
    userId,
    text: newText.value.trim(),
  });


  newText.value = "";
  emit("selectField", "");
}
// ExpansionItem öffnen wenn Feld ausgewählt
watch(
  () => props.selectedFieldId,
  (fieldId) => {
    if (fieldId) {
      open.value[fieldId] = true;
    }
  }
);
</script>

<style scoped>
.comment-list-card {
  height: calc(100vh - 100px);
  overflow-y: auto;
}

.comment-count-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.comment-count {
  position: absolute;
  font-size: 12px;
  font-weight: bold;
  color: var(--q-primary);
}
</style>
