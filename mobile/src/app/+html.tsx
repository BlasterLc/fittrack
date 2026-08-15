import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover: sin esto, con status-bar-style black-translucent
            de abajo, el contenido queda debajo de la barra de estado del
            iPhone — la app depende de env(safe-area-inset-*) en varios
            SafeAreaView para compensar. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0e0e10" />
        <title>FitTrack</title>

        {/* Manifest estandar: lo usan Android/Chrome para "Instalar app". */}
        <link rel="manifest" href="/manifest.json" />

        {/* iOS Safari no lee el manifest para "Agregar a pantalla de
            inicio": necesita sus propias meta tags y su propio icono. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FitTrack" />
        <link rel="apple-touch-icon" href="/icon.png" />

        <ScrollViewStyleReset />

        {/* El backgroundColor de app.json no aplica a la build web: sin esto
            hay un flash blanco al abrir, antes de que React monte. */}
        <style>{`body { background-color: #0e0e10; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
