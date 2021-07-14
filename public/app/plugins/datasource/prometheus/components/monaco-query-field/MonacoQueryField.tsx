import React, { useRef } from 'react';
import { HistoryItem } from '@grafana/data';
import { CodeEditor } from '@grafana/ui';
import { PromQuery } from '../../types';
import { promLanguageDefinition } from 'monaco-promql';
import type * as monacoType from 'monaco-editor/esm/vs/editor/editor.api';
type Monaco = typeof monacoType;
import { getSuggestion } from './suggestions';
import { getCompletions } from './completions';
import type PromQlLanguageProvider from '../../language_provider';
import { useLatest } from 'react-use';

type PromHistoryItem = HistoryItem<PromQuery>;

const setupPromQL = (
  monaco: Monaco,
  lpRef: { current: PromQlLanguageProvider },
  historyRef: { current: PromHistoryItem[] }
) => {
  function provideCompletionItems(
    model: monacoType.editor.ITextModel,
    position: monacoType.Position
  ): monacoType.languages.ProviderResult<monacoType.languages.CompletionList> {
    console.log('pci');
    const word = model.getWordAtPosition(position);
    const range =
      word != null
        ? monaco.Range.lift({
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          })
        : monaco.Range.fromPositions(position);
    // documentation says `position` will be "adjusted" in `getOffsetAt`
    // i don't know what that means, to be sure i clone it
    const positionClone = {
      column: position.column,
      lineNumber: position.lineNumber,
    };
    const offset = model.getOffsetAt(positionClone);
    const suggestion = getSuggestion(model.getValue(), offset);
    const completionsPromise =
      suggestion != null ? getCompletions(suggestion, lpRef.current, historyRef.current) : Promise.resolve([]);
    return completionsPromise.then((items) => {
      const suggestions = items.map((item) => ({
        kind: monaco.languages.CompletionItemKind.Text,
        label: item.label,
        insertText: item.insertText,
        range,
        command: item.suggestOnInsert
          ? {
              id: 'editor.action.triggerSuggest',
              title: '',
            }
          : undefined,
      }));
      return { suggestions };
    });
  }

  const completionProvider: monacoType.languages.CompletionItemProvider = {
    triggerCharacters: ['{', ',', '['],
    provideCompletionItems,
  };

  const langId = promLanguageDefinition.id;
  monaco.languages.register(promLanguageDefinition);
  // monaco.languages.onLanguage(langId, () => {
  promLanguageDefinition.loader().then((mod) => {
    monaco.languages.setMonarchTokensProvider(langId, mod.language);
    monaco.languages.setLanguageConfiguration(langId, mod.languageConfiguration);
    monaco.languages.registerCompletionItemProvider(langId, completionProvider);
  });
  // });
};

const options: monacoType.editor.IStandaloneEditorConstructionOptions = {
  lineNumbers: 'off',
  minimap: { enabled: false },
  lineDecorationsWidth: 0,
  wordWrap: 'off',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  folding: false,
  scrollBeyondLastLine: false,
  // FIXME: more might be needed
};

type Props = {
  initialValue: string;
  languageProvider: PromQlLanguageProvider;
  history: PromHistoryItem[];
  onChange: (query: string) => void;
};

export const MonacoQueryField = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { languageProvider, history, onChange, initialValue } = props;

  const lpRef = useLatest(languageProvider);
  const historyRef = useLatest(history);

  return (
    <div
      // NOTE: we will be setting inline-style-width/height on this element
      ref={containerRef}
    >
      <CodeEditor
        onSave={onChange}
        onBlur={onChange}
        monacoOptions={options}
        language="promql"
        value={initialValue}
        onBeforeEditorMount={(monaco: Monaco) => {
          setupPromQL(monaco, lpRef, historyRef);
        }}
        onEditorDidMount={(editor) => {
          // this code makes the editor resize itself so that the content fits
          // (it will grow taller when necessary)
          const updateElementHeight = () => {
            const containerDiv = containerRef.current;
            if (containerDiv !== null) {
              const pixelHeight = editor.getContentHeight();
              const pixelWidth = containerDiv.clientWidth;
              containerDiv.style.height = `${pixelHeight}px`;
              editor.layout({ width: pixelWidth, height: pixelHeight });
            }
          };

          editor.onDidContentSizeChange(updateElementHeight);
          updateElementHeight();
        }}
      />
    </div>
  );
};
