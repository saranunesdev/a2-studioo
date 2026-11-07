import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { BackendProvider } from './store';
import Entrada from './screens/Entrada';
import Gestao from './screens/gestao/Gestao';
import Atendimento from './screens/atendimento/Atendimento';
import ClientePage, { TelaoPage } from './screens/cliente/ClientePage';

export default function App() {
  return (
    <BackendProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Entrada />} />
            <Route path="/painel/*" element={<Gestao />} />
            <Route path="/atendimento/*" element={<Atendimento />} />
            <Route path="/mesa" element={<Navigate to="/atendimento/mesa" replace />} />
            <Route path="/cliente" element={<ClientePage />} />
            <Route path="/fila" element={<TelaoPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </BackendProvider>
  );
}
