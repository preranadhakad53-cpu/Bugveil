import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { DashboardPage } from './pages/DashboardPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { RepositoryImportPage } from './pages/RepositoryImportPage';
import { PullRequestPage } from './pages/PullRequestPage';
import { FileExplorerPage } from './pages/FileExplorerPage';
import { SecurityFindingsPage } from './pages/SecurityFindingsPage';
import { DependencyGraphPage } from './pages/DependencyGraphPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { ChatbotPage } from './pages/ChatbotPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/repositories" element={<RepositoriesPage />} />
          <Route path="/import" element={<RepositoryImportPage />} />
          <Route path="/pull-requests" element={<PullRequestPage />} />
          <Route path="/explorer" element={<FileExplorerPage />} />
          <Route path="/security" element={<SecurityFindingsPage />} />
          <Route path="/dependencies" element={<DependencyGraphPage />} />
          <Route path="/documentation" element={<DocumentationPage />} />
          <Route path="/chat" element={<ChatbotPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
