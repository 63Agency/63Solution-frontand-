"use client";

import { useState } from "react";
import { MediaGallery } from "./MediaGallery";
import { MediaUploader } from "./MediaUploader";

export function MediasPage() {
  const [galleryKey, setGalleryKey] = useState(0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:px-8">
      <header className="mb-8">
        <h2 className="text-lg font-semibold text-zinc-100">Médias</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Upload via l&apos;API Nest (Cloudinary côté serveur). Dossier par défaut :{" "}
          <span className="font-mono text-zinc-400">63agency</span>
        </p>
      </header>

      <section className="mb-10">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Envoyer des fichiers</h3>
        <MediaUploader folder="63agency" onUploaded={() => setGalleryKey((k) => k + 1)} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Galerie</h3>
        <MediaGallery key={galleryKey} folder="63agency" selectable />
      </section>
    </div>
  );
}
