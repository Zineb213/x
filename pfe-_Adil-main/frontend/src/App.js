import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import StudentRegister from './pages/auth/StudentRegister';
import AdminDashboard from './pages/admin/AdminDashboard';
import SuperAdminDashboard from './pages/superAdmin/SuperAdminDashboard';
import './index.css';
import Users from './pages/admin/Users';
import Modules from './pages/admin/Modules';
import Formateurs from './pages/admin/Formateurs';
import Assignments from './pages/admin/Assignments';
import Enrollments from './pages/admin/Enrollments';
import StudentDashboard from './pages/etudiant/StudentDashboard';
import Communities from './pages/etudiant/Communities';
import CommunityChat from './pages/etudiant/CommunityChat';
import StudentResources from './pages/etudiant/Resources';
import StudentProfile from './pages/etudiant/Profile';
import StudentChat from './pages/etudiant/Chat';
import StudentBot from './pages/etudiant/Bot';
import FormateurDashboard from './pages/formateur/FormateurDashboard';
import MyModules from './pages/formateur/MyModules';
import ResourceUpload from './pages/formateur/ResourceUpload';
import MyResources from './pages/formateur/MyResources';
import MyStudents from './pages/formateur/MyStudents';
import FormateurChat from './pages/formateur/FormateurChat';
import FormateurProfile from './pages/formateur/FormateurProfile';
import LiveSessionPage from './pages/formateur/LiveSession';




// Loading component
const LoadingSpinner = () => (
    <div className="loading-container">
        <div className="loading-spinner"></div>
    </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user, loading } = useAuth();

    if (loading) return <LoadingSpinner />;

    if (!isAuthenticated) return <Navigate to="/login" />;

    if (allowedRoles && !allowedRoles.includes(user?.role_global)) {
        if (user?.role_global === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
        if (user?.role_global === 'ADMIN') return <Navigate to="/admin" />;
        if (['FORMATEUR', 'FORMATEUR_SIMPLE'].includes(user?.role_global)) return <Navigate to="/formateur" />;
        return <Navigate to="/etudiant" />;
    }

    return children;
};

// Role-based redirect after login
const RoleRedirect = () => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingSpinner />;
    if (user?.role_global === 'SUPER_ADMIN') return <Navigate to="/super-admin" />;
    if (['ADMIN', 'ADMIN_GLOBAL'].includes(user?.role_global)) return <Navigate to="/admin" />;
    if (['FORMATEUR', 'FORMATEUR_SIMPLE', 'MODERATEUR'].includes(user?.role_global)) return <Navigate to="/formateur" />;
    return <Navigate to="/etudiant" />;
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<StudentRegister />} />
                    <Route path="/" element={<RoleRedirect />} />

                    {/* Super Admin Routes */}
                    <Route path="/super-admin" element={
                        <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Navigate to="schools" replace />} />
                        <Route path="schools" element={<SuperAdminDashboard />} />
                    </Route>

                    {/* Admin Routes */}
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRoles={['ADMIN', 'ADMIN_GLOBAL']}>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<AdminDashboard />} />
                        <Route path="users" element={<Users />} />
                        <Route path="modules" element={<Modules />} />
                        <Route path="formateurs" element={<Formateurs />} />
                        <Route path="assignments" element={<Assignments />} />
                        <Route path="enrollments" element={<Enrollments />} />
                    </Route>

                    <Route path="/formateur" element={
                        <ProtectedRoute allowedRoles={['FORMATEUR', 'FORMATEUR_SIMPLE', 'MODERATEUR']}>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<FormateurDashboard />} />
                        <Route path="modules" element={<MyModules />} />
                        <Route path="upload" element={<ResourceUpload />} />
                        <Route path="resources" element={<MyResources />} />
                        <Route path="resources/:id/edit" element={<ResourceUpload />} />
                        <Route path="students" element={<MyStudents />} />
                        <Route path="chat" element={<FormateurChat />} />
                        <Route path="communities/:id/chat" element={<CommunityChat />} />
                        <Route path="profile" element={<FormateurProfile />} />
                        <Route path="live" element={<LiveSessionPage />} />
                    </Route>

                    {/* Student Routes */}
                    <Route path="/etudiant" element={
                        <ProtectedRoute allowedRoles={['ETUDIANT']}>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<StudentDashboard />} />
                        <Route path="resources" element={<StudentResources />} />
                        <Route path="communities" element={<Communities />} />
                        <Route path="communities/:id/chat" element={<CommunityChat />} />
                        <Route path="chat" element={<StudentChat />} />
                        <Route path="bot" element={<StudentBot />} />
                        <Route path="profile" element={<StudentProfile />} />
                    </Route>
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
