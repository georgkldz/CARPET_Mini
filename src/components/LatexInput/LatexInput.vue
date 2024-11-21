<template>
  <div class="latex-editor">
    <!-- Eingabe-Bereich -->
    <div v-if="showEditor" class="editor-container">
      <textarea
        v-model="latexContent"
        class="editor"
        placeholder="Gib hier LaTeX ein"
        @input="onUserInput"
      ></textarea>
      <button
        class="submit-button"
        :disabled="!!syntaxError"
        @click="hideEditor"
      >
        Eingabe
      </button>
    </div>

    <!-- Vorschau-Bereich -->
    <div class="preview" @click="handlePreviewClick">
      <h2>Vorschau</h2>
      <div v-if="!showEditor && !latexContent" class="placeholder">
        Latex eingeben, hier klicken
      </div>
      <div v-else v-html="renderedLatex" class="latex-output"></div>
      <div v-if="syntaxError" class="error">{{ friendlyErrorMessage }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, toRefs, unref } from "vue";
import { LatexInputComponent } from "src/components/LatexInput/LatexInput";
import type { LatexInputProps } from "src/components/LatexInput/LatexInput";
import { renderToString } from "katex";
import "katex/dist/katex.min.css";

// Props aus der CARPET Component Library definieren
const props = defineProps<LatexInputProps>();
const { storeObject, componentID, componentPath, modelValue } = toRefs(props); // modelValue dekonstruieren

// LatexInputComponent-Instanz erstellen
const component = new LatexInputComponent(
  storeObject,
  unref(componentID),
  unref(componentPath),
);

// Reaktive Variablen
const latexContent = ref<string>(modelValue.value || ""); // Initialwert von modelValue
const showEditor = ref(false); // Steuert die Sichtbarkeit des Editors
const syntaxError = ref<string | null>(null); // Fehlerstatus

// Benutzerfreundliche Fehlermeldung
const friendlyErrorMessage = computed(() =>
  syntaxError.value ? "Bitte gib eine korrekte LaTeX-Formel ein!" : null
);

// Echtzeit-Rendering des LaTeX-Inhalts
// Watcher für Fehlerprüfung
watch(
  () => latexContent.value,
  (newValue) => {
    try {
      renderToString(newValue || "", { throwOnError: true });
      syntaxError.value = null; // Kein Fehler
    } catch (error) {
      syntaxError.value = error instanceof Error ? error.message : "Syntaxfehler";
    }
  }
);

// Echtzeit-Rendering des LaTeX-Inhalts
const renderedLatex = computed(() => {
  return latexContent.value
    ? renderToString(latexContent.value, { throwOnError: true })
    : "";
});

// Initialisierung und Synchronisierung
onMounted(() => {
  // Initialwert aus den Props laden
  latexContent.value = modelValue.value || "";

  // Syntax validieren
  validateSyntax();

  // Synchronisierung mit dem Store
  watch(latexContent, (newValue) => {
    component.validate(newValue);
    unref(storeObject).setProperty({
      path: `${component.getComponentPath()}.component.fieldValue`,
      value: newValue,
    });
  });
});

// Beobachten von externen Änderungen an modelValue
watch(
  modelValue,
  (newValue) => {
    if (newValue !== latexContent.value) {
      latexContent.value = newValue || ""; // Synchronisierung mit dem lokalen Zustand
    }
  }
);

// Benutzerinteraktionen
const onUserInput = () => {
  validateSyntax();
};

// Funktion zur Syntaxprüfung
const validateSyntax = () => {
  try {
    renderToString(latexContent.value || "", { throwOnError: true });
    syntaxError.value = null; // Kein Fehler
  } catch (error) {
    syntaxError.value = error instanceof Error ? error.message : "Syntaxfehler";
  }
};

// Steuerung des Editors
const hideEditor = () => {
  showEditor.value = false;
};

const handlePreviewClick = () => {
  showEditor.value = true;
};
</script>


<style>
.latex-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.editor-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editor {
  width: 100%;
  height: 133px; /* Ein Drittel der ursprünglichen Höhe */
  border: 1px solid #ccc;
  padding: 10px;
  background-color: white;
  font-family: monospace;
  font-size: 1em;
  resize: none;
}

.submit-button {
  align-self: flex-end;
  padding: 5px 10px;
  font-size: 0.9em;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.submit-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.submit-button:hover:enabled {
  background-color: #0056b3;
}

.preview {
  width: 100%;
  height: auto;
  border: 1px solid #ccc;
  padding: 10px;
  overflow: auto;
  cursor: pointer; /* Zeigt an, dass die Vorschau klickbar ist */
}

.placeholder {
  text-align: center;
  color: #007bff;
  cursor: pointer;
  padding: 10px;
  border: 1px dashed #ccc;
  border-radius: 4px;
}

.placeholder:hover {
  background-color: #f0f8ff;
}

.latex-output {
  font-size: 1.2em;
}

.error {
  color: red;
  font-size: 0.9em;
  margin-top: 10px;
}
</style>
