import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import './FormateurPages.css';

const MyStudents = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const response = await api.get('/formateur/students');
            if (response.data.success) {
                setStudents(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(student =>
        student.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="loading-text">Chargement des étudiants...</div>;

    return (
        <div className="formateur-page fade-in">
            <div className="page-header">
                <h1>Mes Étudiants</h1>
                <p>Étudiants inscrits dans vos modules</p>
            </div>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Rechercher un étudiant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            {students.length === 0 ? (
                <div className="empty-state">
                    <i className="fas fa-user-graduate"></i>
                    <p>Aucun étudiant inscrit</p>
                    <p>Les étudiants apparaîtront ici une fois inscrits à vos modules</p>
                </div>
            ) : (
                <div className="students-grid">
                    {filteredStudents.map(student => (
                        <div key={student.id} className="student-card">
                            <div className="student-avatar">
                                {student.prenom?.charAt(0)}{student.nom?.charAt(0)}
                            </div>
                            <div className="student-info">
                                <h3>{student.prenom} {student.nom}</h3>
                                <p>{student.email}</p>
                                <div className="student-stats">
                                    <span>📚 {student.enrolled_modules || 0} modules</span>
                                    <span>✅ {student.completed_resources || 0} ressources complétées</span>
                                </div>
                                <div className="student-actions">
                                    <button 
                                        className="btn-chat"
                                        onClick={() => window.location.href = `/formateur/chat?studentId=${student.id}`}
                                    >
                                        💬 Contacter
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyStudents;
