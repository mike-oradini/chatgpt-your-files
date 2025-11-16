'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { usePipeline } from '@/lib/hooks/use-pipeline';
import { cn } from '@/lib/utils';
import { Database } from '@/supabase/functions/_lib/database';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useQuery } from '@tanstack/react-query';
import { useChat } from 'ai/react';
import { useEffect, useMemo, useState } from 'react';

const DEFAULT_SESSION_INSTRUCTIONS = `You're an AI assistant that answers questions strictly using the selected documents.

Keep responses crisp, stay within scope, and call out when the files don't contain the answer.`;

type DocumentSummary = {
  id: number;
  name: string;
  created_at: string | null;
};

export default function ChatPage() {
  const supabase = createClientComponentClient<Database>();
  const [sessionInstructions, setSessionInstructions] = useState(
    DEFAULT_SESSION_INSTRUCTIONS
  );
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);

  const generateEmbedding = usePipeline(
    'feature-extraction',
    'Supabase/gte-small'
  );

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
    });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<
    DocumentSummary[]
  >({
    queryKey: ['session-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents_with_storage_path')
        .select('id, name, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          variant: 'destructive',
          description: 'Unable to load your files for this session.',
        });
        throw error;
      }

      return (
        data?.flatMap((doc) =>
          typeof doc?.id === 'number' && typeof doc?.name === 'string'
            ? [
                {
                  id: doc.id,
                  name: doc.name,
                  created_at: doc.created_at ?? null,
                },
              ]
            : []
        ) ?? []
      );
    },
  });

  useEffect(() => {
    setSelectedDocumentIds((current) =>
      current.filter((id) => documents.some((doc) => doc.id === id))
    );
  }, [documents]);

  const selectedDocumentSet = useMemo(
    () => new Set(selectedDocumentIds),
    [selectedDocumentIds]
  );

  const handleToggleDocument = (id: number) => {
    setSelectedDocumentIds((current) =>
      current.includes(id)
        ? current.filter((docId) => docId !== id)
        : [...current, id]
    );
  };

  const handleSelectAllDocuments = () => {
    setSelectedDocumentIds(documents.map((doc) => doc.id));
  };

  const handleUseAllDocuments = () => {
    setSelectedDocumentIds([]);
  };

  const isReady = !!generateEmbedding;
  const activeContextLabel = selectedDocumentIds.length
    ? `Scoped to ${selectedDocumentIds.length} document${
        selectedDocumentIds.length === 1 ? '' : 's'
      }`
    : 'Using all available documents';

  return (
    <div className="max-w-6xl w-full h-full mx-auto flex flex-col gap-6 lg:flex-row p-4 sm:p-8">
      <aside className="w-full lg:w-80 flex-shrink-0 space-y-6">
        <section className="border rounded-xl bg-background/70 p-4 shadow-sm space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Session instructions
            </p>
            <p className="text-xs text-muted-foreground">
              Tune tone, scope, and guardrails for this chat.
            </p>
          </div>
          <Textarea
            value={sessionInstructions}
            onChange={(event) => setSessionInstructions(event.target.value)}
            placeholder="Add guardrails or additional project context..."
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSessionInstructions(DEFAULT_SESSION_INSTRUCTIONS)}
              disabled={sessionInstructions === DEFAULT_SESSION_INSTRUCTIONS}
            >
              Reset
            </Button>
          </div>
        </section>

        <section className="border rounded-xl bg-background/70 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Context files
              </p>
              <p className="text-xs text-muted-foreground">
                {documentsLoading
                  ? 'Loading files...'
                  : documents.length > 0
                  ? `${documents.length} uploaded`
                  : 'Upload files from the Files tab'}
              </p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {selectedDocumentIds.length > 0 ? (
                <>
                  {selectedDocumentIds.length} selected
                  {documents.length > 0
                    ? ` · ${Math.round(
                        (selectedDocumentIds.length / documents.length) * 100
                      )}%`
                    : null}
                </>
              ) : (
                'All files'
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleSelectAllDocuments}
              disabled={documents.length === 0}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={handleUseAllDocuments}
              disabled={selectedDocumentIds.length === 0}
            >
              Use all
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {documentsLoading ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                Loading files...
              </div>
            ) : documents.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                Upload files to ground the assistant with real project context.
              </div>
            ) : (
              documents.map((document) => {
                const isSelected = selectedDocumentSet.has(document.id);
                return (
                  <button
                    key={document.id}
                    type="button"
                    className={cn(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-dashed hover:border-blue-400'
                    )}
                    onClick={() => handleToggleDocument(document.id)}
                  >
                    <div className="text-sm font-medium truncate">
                      {document.name}
                    </div>
                    {document.created_at && (
                      <div className="text-xs text-muted-foreground">
                        {new Date(document.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>
      </aside>

      <section className="flex-1 flex flex-col rounded-xl border bg-background shadow-sm min-h-[420px]">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Conversation</p>
          <p className="text-xs text-muted-foreground">{activeContextLabel}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-3">
          {messages.map(({ id, role, content }) => (
            <div
              key={id}
              className={cn(
                'rounded-xl bg-gray-500 text-white px-4 py-2 max-w-lg',
                role === 'user' ? 'self-end bg-blue-600' : 'self-start'
              )}
            >
              {content}
            </div>
          ))}
          {isLoading && (
            <div className="self-start m-2 text-gray-500 before:text-gray-500 after:text-gray-500 dot-pulse" />
          )}
          {messages.length === 0 && !isLoading && (
            <div className="self-stretch flex grow items-center justify-center text-center text-sm text-muted-foreground">
              Drop instructions on the left, select the files that matter, and
              ask your first question.
            </div>
          )}
        </div>

        <form
          className="border-t p-4 flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!generateEmbedding) {
              throw new Error('Unable to generate embeddings');
            }

            const output = await generateEmbedding(input, {
              pooling: 'mean',
              normalize: true,
            });

            const embedding = JSON.stringify(Array.from(output.data));
            const instructions =
              sessionInstructions.trim().length > 0
                ? sessionInstructions.trim()
                : DEFAULT_SESSION_INSTRUCTIONS;

            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
              toast({
                variant: 'destructive',
                description: 'Please sign in again to continue chatting.',
              });
              return;
            }

            handleSubmit(e, {
              options: {
                headers: {
                  authorization: `Bearer ${session.access_token}`,
                },
                body: {
                  embedding,
                  instructions,
                  document_ids:
                    selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
                },
              },
            });
          }}
        >
          <Input
            type="text"
            autoFocus
            placeholder="Send a message"
            value={input}
            onChange={handleInputChange}
            className="flex-1"
          />
          <Button type="submit" disabled={!isReady}>
            Send
          </Button>
        </form>
      </section>
    </div>
  );
}
