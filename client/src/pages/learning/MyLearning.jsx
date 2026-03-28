import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCourseStore } from '../../store/courseStore';

const MyLearning = () => {
  const { courses, fetchCourses, loading } = useCourseStore();
  const [tab, setTab] = useState(0);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const inProgress = courses.filter((c) => c.is_published);
  const completed = courses.filter((c) => false); // Always empty in original code?

  const displayed = tab === 0 ? inProgress : completed;

  return (
    <div className="bg-background font-body text-on-surface w-full min-h-screen">
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Dashboard Header */}
        <div className="mb-12">
          <h1 className="font-headline text-4xl font-extrabold text-primary mb-2 tracking-tight">My Learning</h1>
          <p className="text-on-surface-variant font-body">
            You have {inProgress.length} active courses and {completed.length} certificates pending.
          </p>
        </div>

        {/* Filter Tabs & Stats Section */}
        <div className="flex flex-col lg:flex-row gap-8 mb-12 items-start">
          <div className="flex-1 w-full">
            {/* Tabs */}
            <div className="flex gap-8 mb-8 overflow-x-auto border-b border-outline-variant pb-1">
              <button 
                onClick={() => setTab(0)}
                className={`font-headline font-bold text-lg pb-4 transition-colors whitespace-nowrap ${tab === 0 ? 'text-primary border-b-2 border-surface-tint' : 'text-on-surface-variant hover:text-primary'}`}>
                In Progress ({inProgress.length})
              </button>
              <button 
                onClick={() => setTab(1)}
                className={`font-headline font-medium text-lg pb-4 transition-colors whitespace-nowrap ${tab === 1 ? 'text-primary border-b-2 border-surface-tint' : 'text-on-surface-variant hover:text-primary'}`}>
                Completed ({completed.length})
              </button>
            </div>

            {loading ? (
              <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-1/2 rounded-full"></div>
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant flex flex-col items-center">
                <span className="material-symbols-outlined text-6xl opacity-20 mb-4 block">school</span>
                <h3 className="font-headline font-bold text-xl mb-2">{tab === 0 ? 'No courses in progress' : 'No completed courses yet'}</h3>
                <p className="mb-6">{tab === 0 ? 'Browse the course catalog to start learning.' : 'Complete your enrolled courses to see them here.'}</p>
                <Link to="/dashboard/courses" className="bg-primary text-white font-headline font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-all">
                  Browse Courses
                </Link>
              </div>
            ) : (
              /* Active Course Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {displayed.map((course, idx) => {
                  const progress = Math.floor(Math.random() * 80) + 10;
                  const isCompleted = tab === 1;
                  const dashOffset = 188.4 - (188.4 * progress) / 100;
                  
                  return (
                    <div key={course.id} className="group bg-surface-container-lowest p-8 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 relative overflow-hidden border border-surface-dim">
                      <div className="flex justify-between items-start mb-6">
                        <div className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-xs font-bold font-label">
                          {course.category || 'Course'}
                        </div>
                        <div className="relative w-16 h-16">
                          <svg className="w-16 h-16 transform -rotate-90 origin-center">
                            <circle className="text-surface-container-high" cx="32" cy="32" fill="transparent" r="30" stroke="currentColor" strokeWidth="4"></circle>
                            <circle className="text-surface-tint transition-all duration-1000 ease-out" cx="32" cy="32" fill="transparent" r="30" stroke="currentColor" strokeDasharray="188.4" strokeDashoffset={dashOffset} strokeWidth="4"></circle>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold font-label text-primary">
                            {isCompleted ? '100%' : `${progress}%`}
                          </div>
                        </div>
                      </div>
                      
                      <h3 className="font-headline text-xl font-bold text-on-surface mb-3 group-hover:text-primary transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="text-on-surface-variant text-sm mb-6 font-body leading-relaxed line-clamp-2">
                        {course.description || "Instructor: BOL-LMS Instructor"}
                      </p>
                      
                      <Link to={`/dashboard/learning/${course.id}`} className="block w-full text-center bg-surface-container-low text-primary font-headline font-bold py-3 rounded-xl group-hover:bg-primary group-hover:text-white transition-all">
                        {isCompleted ? 'View Certificate' : 'Resume Lesson'}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats Sidebar */}
          <aside className="w-full lg:w-80 space-y-8">
            <div className="bg-surface-container-low p-8 rounded-xl">
              <h4 className="font-headline font-bold text-primary mb-6 text-sm uppercase tracking-wider">Your Progress</h4>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined">timer</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black font-headline text-primary">--</div>
                    <div className="text-xs text-on-surface-variant font-label uppercase">Time Spent</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined">workspace_premium</span>
                  </div>
                  <div>
                    <div className="text-2xl font-black font-headline text-primary">{completed.length}</div>
                    <div className="text-xs text-on-surface-variant font-label uppercase">Courses Completed</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-outline-variant">
                <p className="text-sm font-medium italic text-on-surface-variant leading-relaxed">
                  "The beautiful thing about learning is that no one can take it away from you."
                </p>
                <p className="text-xs mt-2 font-bold text-primary">— B.B. King</p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default MyLearning;
