"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  type FaqAutoReply,
  createLocalFaqAutoReply,
  deleteFaqAutoReply,
  fetchFaqAutoReplies,
  isSystemFaqAutoReply,
  parseThreshold,
  readCachedFaqAutoReplies,
  saveFaqAutoReply,
  scoreReplyAcceptance,
  upsertCachedFaqAutoReply,
} from "./autoReplies";
import { Button, Field, Input, Switch, TextArea } from "./ui";

function parsePhrase(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function addPhrase(phrases: string[], value: string) {
  const phrase = parsePhrase(value);
  if (!phrase) return phrases;
  const key = phrase.toLowerCase();
  if (phrases.some((item) => item.toLowerCase() === key)) return phrases;
  return [...phrases, phrase];
}

function AutoReplyCard({
  item,
  draftPhrase,
  testText,
  saving,
  deleting,
  onDraftPhraseChange,
  onTestTextChange,
  onChange,
  onSave,
  onDelete,
}: {
  item: FaqAutoReply;
  draftPhrase: string;
  testText: string;
  saving: boolean;
  deleting: boolean;
  onDraftPhraseChange: (value: string) => void;
  onTestTextChange: (value: string) => void;
  onChange: (next: FaqAutoReply) => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const acceptance = useMemo(
    () => scoreReplyAcceptance(testText, item.phrases),
    [item.phrases, testText],
  );
  const passes = testText.trim().length > 0 && acceptance >= item.threshold;

  const submitPhrase = (event?: FormEvent) => {
    event?.preventDefault();
    const nextPhrases = addPhrase(item.phrases, draftPhrase);
    if (nextPhrases === item.phrases) return;
    onChange({ ...item, phrases: nextPhrases });
    onDraftPhraseChange("");
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="grid flex-1 gap-3">
          <Field label="Nombre">
            <Input
              placeholder="Ej. Costos de envio"
              value={item.title}
              onChange={(title) => onChange({ ...item, title })}
            />
          </Field>
          <p className="text-sm text-slate-500">
            Si el cliente escribe alguna de estas frases y alcanza el porcentaje
            de aceptacion, TAKU responde automaticamente.
          </p>
        </div>
        <div className="md:w-56">
          <Switch
            checked={item.enabled}
            label={item.enabled ? "Activa" : "Inactiva"}
            onChange={(enabled) => onChange({ ...item, enabled })}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-slate-700">
            Palabras clave o frases
          </p>
          <div className="flex flex-wrap gap-2">
            {item.phrases.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() =>
                  onChange({
                    ...item,
                    phrases: item.phrases.filter((row) => row !== phrase),
                  })
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800 hover:border-slate-950"
              >
                <span>{phrase}</span>
                <span className="text-slate-400">×</span>
              </button>
            ))}
            {item.phrases.length === 0 ? (
              <p className="text-sm text-slate-500">
                Agrega al menos una frase para disparar esta respuesta.
              </p>
            ) : null}
          </div>
          <form
            onSubmit={submitPhrase}
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <Field label="Agregar frase">
              <Input
                placeholder="Ej. cuanto cuesta el envio"
                value={draftPhrase}
                onChange={onDraftPhraseChange}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={!parsePhrase(draftPhrase)}
            >
              Agregar
            </Button>
          </form>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
          <Field
            label="Mensaje de prueba"
            hint="Escribe un mensaje de cliente para ver si esta respuesta se dispararia."
          >
            <Input
              placeholder="Ej. Cual es el costo del envio?"
              value={testText}
              onChange={onTestTextChange}
            />
          </Field>
          <Field label="Aceptacion">
            <Input
              readOnly
              placeholder="0%"
              value={testText.trim() ? `${acceptance}%` : ""}
            />
          </Field>
        </div>
        {testText.trim() ? (
          <p
            className={`text-sm ${
              passes ? "text-slate-950" : "text-slate-500"
            }`}
          >
            {passes
              ? `Alcanza el umbral (${item.threshold}%). Se enviaria la respuesta.`
              : `No alcanza el umbral (${item.threshold}%). No se enviaria.`}
          </p>
        ) : null}

        <Field
          label="Porcentaje de aceptacion"
          hint="Minimo para disparar esta respuesta. 80 es el valor de las banderas."
        >
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="80"
            value={String(item.threshold)}
            onChange={(value) =>
              onChange({
                ...item,
                threshold: value.trim()
                  ? parseThreshold(value, item.threshold)
                  : 80,
              })
            }
          />
        </Field>

        <Field
          label="Respuesta automatica"
          hint="Este texto se envia cuando un mensaje alcanza el porcentaje."
        >
          <TextArea
            rows={5}
            placeholder="Escribe la respuesta que debe mandar TAKU."
            value={item.responseText}
            onChange={(responseText) => onChange({ ...item, responseText })}
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <Button disabled={saving || deleting} onClick={onSave}>
            {saving ? "Guardando..." : "Guardar respuesta"}
          </Button>
          {onDelete ? (
            <Button
              variant="secondary"
              disabled={saving || deleting}
              onClick={onDelete}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function AutoRepliesPanel() {
  const [items, setItems] = useState<FaqAutoReply[]>(() =>
    readCachedFaqAutoReplies(),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchFaqAutoReplies()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((error) => {
        if (cancelled) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las respuestas automaticas.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateItem = (next: FaqAutoReply) => {
    setItems(upsertCachedFaqAutoReply(next));
  };

  const addReply = () => {
    const created = createLocalFaqAutoReply();
    setItems(upsertCachedFaqAutoReply(created));
    setMessage("Nueva respuesta agregada. Completa frases, umbral y texto.");
  };

  const saveItem = async (item: FaqAutoReply) => {
    setSavingId(item.id);
    setMessage(null);
    try {
      const saved = await saveFaqAutoReply(item);
      setItems(readCachedFaqAutoReplies());
      setMessage(`Respuesta de ${saved.title.toLowerCase()} guardada.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la respuesta automatica.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const deleteItem = async (item: FaqAutoReply) => {
    setDeletingId(item.id);
    setMessage(null);
    try {
      const next = await deleteFaqAutoReply(item);
      setItems(next);
      setMessage(`Respuesta de ${item.title.toLowerCase()} eliminada.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar la respuesta automatica.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          Estas son las mismas banderas del inbox: horarios, ubicacion y costos
          de envio. Tambien puedes agregar mas respuestas con sus propias frases
          y porcentaje de aceptacion.
        </p>
        <Button onClick={addReply}>Agregar respuesta</Button>
      </div>
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}
      {items.map((item) => (
        <AutoReplyCard
          key={item.id}
          item={item}
          draftPhrase={drafts[item.id] ?? ""}
          testText={tests[item.id] ?? ""}
          saving={savingId === item.id}
          deleting={deletingId === item.id}
          onDraftPhraseChange={(value) =>
            setDrafts((current) => ({ ...current, [item.id]: value }))
          }
          onTestTextChange={(value) =>
            setTests((current) => ({ ...current, [item.id]: value }))
          }
          onChange={updateItem}
          onSave={() => void saveItem(item)}
          onDelete={
            isSystemFaqAutoReply(item.intent)
              ? undefined
              : () => void deleteItem(item)
          }
        />
      ))}
    </div>
  );
}
