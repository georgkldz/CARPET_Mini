<template>
  <div class="comment-page q-pa-md">
    <div v-if="!isLoading" class="row q-gutter-lg">
      <!-- linke Spalte: Formular -->
      <div class="col-12 col-md-7">
        <div class="comment-form-wrapper" @click="handleFormClick">
          <component
            v-if="formComponent"
            :is="formComponent.type"
            :componentID="String(formComponentId)"
            :storeObject="storeObject"
            :componentPath="`$.nodes.${currentNodeId}.components.${formComponentId}`"
            :readonly="true"
          />
        </div>
      </div>

      <!-- rechte Spalte: Kommentare -->
      <div class="col-12 col-md-4">
        <CommentList
          :session-id="sessionId"
          :selected-field-id="selectedField"
          @highlightField="highlightField"
          @selectField="setSelectedField"/>
      </div>
    </div>

    <div v-else class="text-center q-pa-xl">
      <q-spinner size="50px" />
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, onMounted, computed, onUnmounted} from "vue";
import { useRoute } from "vue-router";
import { useTaskGraphStore } from "src/stores/taskGraphStore";
import { useCommentStore } from "src/stores/commentStore";
import CommentList from "pages/CommentList.vue";
import { JSONPathExpression } from "carpet-component-library";

const route = useRoute();
const sessionId = Number(route.params.sessionId);

const taskGraphStore = useTaskGraphStore();
const commentStore = useCommentStore();

// Reactive state
const isLoading = ref(true);
const currentNodeId = ref<number | null>(null);
const highlightedField = ref<string | null>(null);
const selectedField = ref<string | null>(null);

// Computed properties
const currentNode = computed(() =>
  currentNodeId.value ? taskGraphStore.nodes[currentNodeId.value] : null
);

const formComponent = computed(() =>
  currentNode.value?.components?.[0] || null
);

const formComponentId = 0;

const storeObject = {
  store: taskGraphStore,
  getProperty: taskGraphStore.getProperty,
  setProperty: taskGraphStore.setProperty
};


// Lifecycle
onMounted(async () => {
  try {
    // Session laden
    await taskGraphStore.loadSessionForCommentMode(sessionId);
    await commentStore.fetchCommentsForSession(sessionId);
    currentNodeId.value = taskGraphStore.currentNode as number;

    isLoading.value = false;

  } catch (error) {
    console.error("Fehler beim Laden der Session:", error);
    isLoading.value = false;
  }
});

onUnmounted(() => {
  commentStore.disconnectWebSocket()
});

// Methods
function highlightField(fieldId: string | null): void {
  highlightedField.value = fieldId;

  // CSS-Klasse für Highlighting hinzufügen/entfernen
  if (fieldId) {
    document.querySelectorAll(".comment-highlight").forEach(el =>
      el.classList.remove("comment-highlight")
    );
    const element = document.querySelector(`.form__elements-${fieldId}`);
    element?.classList.add("comment-highlight");
  } else {
    document.querySelectorAll(".comment-highlight").forEach(el =>
      el.classList.remove("comment-highlight")
    );
  }
}

function setSelectedField(fieldId: string): void {
  selectedField.value = fieldId;

  // Scroll zum Feld
  const element = document.querySelector(`.form__elements-${fieldId}`);
  element?.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Event handler für Klicks auf Formularfelder
function handleFormClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const fieldElement = target.closest('[class*="form__elements-"]');

  if (fieldElement) {
    const classes = Array.from(fieldElement.classList);
    const fieldClass = classes.find(c => c.startsWith("form__elements-") && c !== "form__elements");

    if (fieldClass) {
      const fieldId = fieldClass.replace("form__elements-", "");
      if (fieldId && isFieldCommentable(fieldId)) {
        setSelectedField(fieldId);
      }
    }
  }
}

function isFieldCommentable(fieldId: string): boolean {
  const sections = ["formComponents", "extraRightComponents", "actionComponents"];

  for (const section of sections) {
    const path = `$.nodes.${currentNodeId.value}.components.0.nestedComponents.${section}.${fieldId}.componentConfiguration.isCommentable` as JSONPathExpression;
    const isCommentable = taskGraphStore.getProperty(path);

    if (isCommentable === true) {
      return true;
    }
  }

  return false;
}
</script>

<style scoped>
.comment-page {
  height: 100vh;
  overflow-y: auto;
}

.comment-form-wrapper {
  cursor: pointer;
}

/* Highlight-Stil */
:deep(.comment-highlight) {
  outline: 3px solid #1976d2;
  outline-offset: 2px;
  background-color: rgba(25, 118, 210, 0.08);
  transition: all 0.2s ease;
}
</style>
