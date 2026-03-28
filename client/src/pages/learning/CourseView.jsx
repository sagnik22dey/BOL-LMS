import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import CommentSection from '../../components/learning/CommentSection';
import DocumentViewer from '../../components/learning/DocumentViewer';
import QuizView from '../../components/learning/QuizView';
import AssignmentView from '../../components/learning/AssignmentView';

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [course, setCourse] = useState(null);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [lowerTab, setLowerTab] = useState(0);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/courses/${courseId}`);
        setCourse(response.data);
        if (response.data.modules && response.data.modules.length > 0) {
          const firstMod = response.data.modules[0];
          setActiveModule(firstMod);
          if (firstMod.materials && firstMod.materials.length > 0) {
            setActiveMaterial(firstMod.materials[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch course:', err);
        setError('Failed to load course details.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseId]);

  useEffect(() => {
    const fetchFileUrl = async () => {
      if (activeMaterial && activeMaterial.file_key && activeMaterial.type !== 'text') {
        try {
          const bucket = activeMaterial.type === 'video' ? 'bol-lms-videos' : 'bol-lms-documents';
          const response = await api.get('/api/learning/presign-get', {
            params: { object_name: activeMaterial.file_key, bucket }
          });
          setFileUrl(response.data.url);
        } catch (err) {
          console.error('Failed to fetch file URL:', err);
          setFileUrl('');
        }
      } else {
        setFileUrl('');
      }
    };
    fetchFileUrl();
  }, [activeMaterial]);

  const handleSelectMaterial = (mod, mat) => {
    setActiveModule(mod);
    setActiveMaterial(mat);
  };

  if (loading) return <div className="flex justify-center p-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (error) return <div className="m-8 p-4 bg-error-container text-on-error-container rounded-lg font-body">{error}</div>;
  if (!course) return <div className="m-8 p-4 bg-surface-container text-on-surface rounded-lg font-body">Course not found</div>;

  const renderMaterialPreview = () => {
    if (!activeMaterial) return (
      <div className="flex items-center justify-center h-full bg-black/90 text-white font-headline text-lg tracking-wide rounded-b-xl lg:rounded-br-none lg:rounded-bl-xl overflow-hidden">
        No materials to display
      </div>
    );

    switch (activeMaterial.type) {
      case 'video':
        return (
          <video
            className="w-full h-full object-cover"
            controls
            key={activeMaterial.file_key}
            src={fileUrl || (activeMaterial.file_key?.startsWith('http') ? activeMaterial.file_key : '')}
          >
            Your browser does not support the video tag.
          </video>
        );
      case 'text':
        return (
          <div className="bg-surface-container-lowest p-8 md:p-16 h-full overflow-y-auto w-full border border-surface-container-highest">
            <div className="whitespace-pre-wrap leading-relaxed text-on-surface-variant font-body">
              {activeMaterial.content}
            </div>
          </div>
        );
      case 'quiz':
        return <div className="bg-surface-container-lowest border border-surface-container-highest h-full overflow-y-auto w-full p-4 md:p-8"><QuizView quizId={activeMaterial.file_key} /></div>;
      case 'assignment':
        return <div className="bg-surface-container-lowest border border-surface-container-highest h-full overflow-y-auto w-full p-4 md:p-8"><AssignmentView assignmentId={activeMaterial.file_key} /></div>;
      default:
        return (
          <div className="h-full bg-surface-container-lowest border border-surface-container-highest w-full flex flex-col items-center justify-center p-8 text-center overflow-y-auto">
            {activeMaterial.file_key && fileUrl ? (
               <div className="w-full h-full relative z-0"><DocumentViewer url={fileUrl} fileType={activeMaterial.type} /></div>
            ) : fileUrl === '' ? (
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-6xl text-outline mb-4">description</span>
                <h3 className="text-xl font-headline font-bold text-on-surface mb-2">{activeMaterial.title}</h3>
                <p className="text-on-surface-variant">File not available for viewing.</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <button 
          onClick={() => navigate('/dashboard/courses')}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-headline font-bold text-sm w-fit"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Back to Courses
        </button>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl flex items-center gap-2 font-headline tracking-wide text-xs font-bold uppercase border border-primary/20">
              <span className="material-symbols-outlined text-[18px]">visibility</span>
              ADMIN PREVIEW MODE
            </div>
            <button 
              onClick={() => navigate(`/dashboard/courses/${courseId}/assessments`)}
              className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
              View Student Submissions
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row flex-1 bg-surface border border-surface-dim shadow-sm rounded-2xl overflow-hidden min-h-[calc(100vh-200px)]">
        {/* Center Content: Player & Tabs */}
        <div className="flex-1 flex flex-col bg-surface overflow-y-auto">
        {/* Video Player Section */}
        <section className={`bg-inverse-surface w-full relative ${activeMaterial?.type === 'video' ? 'aspect-video' : 'h-[60vh] min-h-[400px]'}`}>
          {renderMaterialPreview()}
        </section>

        {/* Content Area: Tabs & Description */}
        <section className="p-8 lg:p-12 max-w-5xl mx-auto w-full flex-grow">
          <div className="flex items-center gap-8 border-b border-surface-dim mb-8 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setLowerTab(0)}
              className={`pb-4 text-sm font-bold font-headline whitespace-nowrap transition-colors ${lowerTab === 0 ? 'text-primary border-b-2 border-primary' : 'text-outline hover:text-on-surface'}`}>
              Overview
            </button>
            <button 
              onClick={() => setLowerTab(1)}
              className={`pb-4 text-sm font-bold font-headline whitespace-nowrap transition-colors ${lowerTab === 1 ? 'text-primary border-b-2 border-primary' : 'text-outline hover:text-on-surface'}`}>
              Q&A / Discussions
            </button>
          </div>

          {lowerTab === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="md:col-span-2 space-y-6">
                <h2 className="text-3xl font-extrabold font-headline tracking-tight text-primary">
                  {activeMaterial?.title || 'Material Overview'}
                </h2>
                <p className="text-on-surface-variant leading-relaxed font-body text-lg">
                  {course.description || "Course description goes here. Learn the foundational concepts through curated material."}
                </p>
                <div className="space-y-4 pt-4">
                  <h3 className="font-headline font-bold text-lg text-on-surface">Module Details</h3>
                  <p className="text-on-surface-variant">
                    {activeModule ? activeModule.title : 'Select a module to view details.'}
                  </p>
                </div>
              </div>
              <div className="space-y-8">
                <div className="bg-surface-container-low p-6 rounded-2xl border border-surface-dim">
                  <h4 className="font-headline font-bold text-primary mb-4">Instructor</h4>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-primary-fixed text-primary flex items-center justify-center font-bold text-lg">
                      {course.creator_name ? course.creator_name.charAt(0).toUpperCase() : 'L'}
                    </div>
                    <div>
                      <p className="font-headline font-bold text-on-surface">{course.creator_name || 'Lead Instructor'}</p>
                      <p className="text-xs text-outline font-medium">Instructor</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {lowerTab === 1 && (
            <div>
              {activeModule ? <CommentSection moduleId={activeModule.id} /> : <p className="text-on-surface-variant">Select a module to view notes.</p>}
            </div>
          )}
        </section>
      </div>

      {/* Sidebar: Curriculum Navigation */}
      <aside className="w-full lg:w-96 bg-surface-container-low flex flex-col h-auto lg:h-[calc(100vh-80px)] lg:sticky lg:top-20 z-10 border-l border-surface-dim overflow-hidden">
        <div className="p-6 border-b border-surface-dim bg-surface-bright shadow-sm">
          <h2 className="font-headline font-extrabold text-xl text-primary tracking-tight">Course Content</h2>
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-bold text-outline uppercase">
              <span>Progress</span>
              <span>Active</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
          {(course.modules || []).map((mod, modIdx) => (
            <div key={mod.id || modIdx} className="bg-surface-bright/50 border-b border-surface-dim">
              <div className="w-full p-5 flex flex-col items-start justify-between">
                <p className="text-[10px] font-black text-outline uppercase tracking-widest mb-1">Module {modIdx + 1}</p>
                <p className="font-headline font-bold text-on-surface">{mod.title}</p>
              </div>
              
              <div className="bg-surface-container-lowest flex flex-col border-t border-surface-dim/30 divide-y divide-surface-dim/30">
                {(mod.materials || []).map((mat) => {
                  const isActive = activeMaterial?.id === mat.id;
                  
                  return (
                    <button
                      key={mat.id}
                      onClick={() => handleSelectMaterial(mod, mat)}
                      className={`px-5 py-4 flex items-center gap-4 transition-colors w-full text-left border-l-4 ${isActive ? 'bg-primary-fixed-dim/30 border-primary' : 'hover:bg-surface-bright border-transparent'}`}
                    >
                      <span className={`material-symbols-outlined text-lg ${isActive ? 'text-primary' : 'text-outline hover:text-on-surface'}`}>
                         {mat.type === 'video' ? 'play_circle' : mat.type === 'text' ? 'article' : mat.type === 'quiz' ? 'quiz' : 'assignment'}
                      </span>
                      <div className="flex-1">
                        <p className={`text-sm ${isActive ? 'font-bold text-primary max-w-[200px] truncate' : 'font-medium text-on-surface-variant max-w-[200px] truncate'}`}>
                          {mat.title}
                        </p>
                        <p className="text-[10px] uppercase font-bold text-outline mt-0.5">{mat.type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {(!course.modules || course.modules.length === 0) && (
            <div className="p-8 text-center text-on-surface-variant font-body text-sm">
              No modules available for this course.
            </div>
          )}
        </div>
      </aside>
    </div>
    </div>
  );
};

export default CourseView;
