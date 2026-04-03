import { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../api/axios';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Box, Typography, Paper, Button, TextField, List, ListItem, ListItemText, 
  IconButton, Divider, Dialog, DialogTitle, DialogContent, DialogActions, 
  CircularProgress, Alert, Snackbar, FormControlLabel, Switch
} from '@mui/material';
import { 
  DragIndicator as DragIcon, 
  Delete as DeleteIcon, 
  Add as AddIcon, 
  Edit as EditIcon,
  ArrowBack as BackIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { 
  DndContext, closestCenter, KeyboardSensor, PointerSensor, 
  useSensor, useSensors 
} from '@dnd-kit/core';
import { 
  arrayMove, SortableContext, sortableKeyboardCoordinates, 
  verticalListSortingStrategy, useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCourseStore } from '../../store/courseStore';
import QuizEditor from './QuizEditor';
import AssignmentEditor from './AssignmentEditor';

const SortableModule = ({ mod, onDelete, onAddMaterial, onDeleteMaterial, onEditMaterial, onEditModuleTitle }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mod.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Paper ref={setNodeRef} style={style} elevation={1} sx={{ p: 2, mb: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
          <DragIcon sx={{ color: 'action.active', mr: 2 }} />
        </Box>
        <TextField 
          variant="standard" 
          value={mod.title} 
          onChange={(e) => onEditModuleTitle(mod.id, e.target.value)}
          sx={{ flexGrow: 1, '& .MuiInput-root': { fontSize: '1.25rem', fontWeight: 'medium' } }}
        />
        <IconButton color="error" size="small" onClick={() => onDelete(mod.id)}><DeleteIcon /></IconButton>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <List dense>
        {(mod.materials || []).map((material, index) => (
          <ListItem key={material.id || index} sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 1 }}>
            <DragIcon sx={{ color: 'action.active', mr: 2 }} fontSize="small" />
            <ListItemText 
              primary={material.title} 
              secondary={material.type.toUpperCase()} 
            />
            <Button size="small" variant="outlined" sx={{ mr: 1 }} startIcon={<EditIcon />} onClick={() => onEditMaterial(mod.id, material)}>Edit</Button>
            <IconButton color="error" size="small" onClick={() => onDeleteMaterial(mod.id, material.id)}><DeleteIcon /></IconButton>
          </ListItem>
        ))}
        {(!mod.materials || mod.materials.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mb: 1 }}>No content added yet.</Typography>
        )}
      </List>
      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={() => onAddMaterial(mod.id, 'video')}>Video</Button>
        <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={() => onAddMaterial(mod.id, 'document')}>Upload Document</Button>
        <Button startIcon={<AddIcon />} size="small" variant="outlined" onClick={() => onAddMaterial(mod.id, 'text')}>Text</Button>
        <Button startIcon={<AddIcon />} size="small" variant="outlined" color="secondary" onClick={() => onAddMaterial(mod.id, 'quiz')}>Quiz</Button>
        <Button startIcon={<AddIcon />} size="small" variant="outlined" color="secondary" onClick={() => onAddMaterial(mod.id, 'assignment')}>Assignment</Button>
      </Box>
    </Paper>
  );
};

const CourseBuilder = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { currentCourse, fetchCourseById, updateCourse, loading, error } = useCourseStore();
  
  const [courseData, setCourseData] = useState({
    title: '',
    description: '',
    modules: [],
    is_public: false,
    instructor_name: '',
    instructor_bio: ''
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (courseId) {
      fetchCourseById(courseId);
    }
  }, [courseId, fetchCourseById]);

  useEffect(() => {
    if (currentCourse) {
      setCourseData({
        title: currentCourse.title || '',
        description: currentCourse.description || '',
        modules: currentCourse.modules || [],
        is_public: currentCourse.is_public || false,
        instructor_name: currentCourse.instructor_name || '',
        instructor_bio: currentCourse.instructor_bio || ''
      });
    }
  }, [currentCourse]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
       const oldIndex = courseData.modules.findIndex(item => item.id === active.id);
       const newIndex = courseData.modules.findIndex(item => item.id === over.id);
       const newModules = arrayMove(courseData.modules, oldIndex, newIndex);
       setCourseData({ ...courseData, modules: newModules });
    }
  };

  const addModule = () => {
    const newId = `mod_${Date.now()}`;
    setCourseData({
        ...courseData,
        modules: [...courseData.modules, { id: newId, title: 'New Module', order: courseData.modules.length, materials: [] }]
    });
  };

  const deleteModule = (id) => {
    setCourseData({
        ...courseData,
        modules: courseData.modules.filter(m => m.id !== id)
    });
  };

  const editModuleTitle = (id, newTitle) => {
    setCourseData({
        ...courseData,
        modules: courseData.modules.map(m => m.id === id ? { ...m, title: newTitle } : m)
    });
  };

  const addMaterial = (moduleId, type) => {
    setCourseData({
      ...courseData,
      modules: courseData.modules.map(mod => {
        if (mod.id === moduleId) {
          const newMaterial = {
            id: `mat_${Date.now()}`,
            title: `New ${type.toUpperCase()}`,
            type: type,
            order: (mod.materials || []).length
          };
          return { ...mod, materials: [...(mod.materials || []), newMaterial] };
        }
        return mod;
      })
    });
  };

  const deleteMaterial = (moduleId, materialId) => {
    setCourseData({
      ...courseData,
      modules: courseData.modules.map(mod => {
        if (mod.id === moduleId) {
          return { ...mod, materials: mod.materials.filter(m => m.id !== materialId) };
        }
        return mod;
      })
    });
  };

  const openEditMaterial = (moduleId, material) => {
    setEditingModuleId(moduleId);
    setEditingMaterial({ ...material });
    setEditDialogOpen(true);
  };

  const saveEditedMaterial = () => {
    setCourseData({
      ...courseData,
      modules: courseData.modules.map(mod => {
        if (mod.id === editingModuleId) {
          return {
            ...mod,
            materials: mod.materials.map(m => m.id === editingMaterial.id ? editingMaterial : m)
          };
        }
        return mod;
      })
    });
    setEditDialogOpen(false);
  };

  const handleSaveCourse = async () => {
    if (!courseId) return;
    
    // Clean up IDs for backend (remove temporary 'mod_' and 'mat_' prefixes if needed, 
    // but the backend expects primitive.ObjectID or it will fail if they are not hex strings)
    // Actually, MongoDB driver in Go will handle string IDs as long as they are not used for _id 
    // but here we are sending them as 'id' which is mapped to '_id,omitempty'.
    // If they are not valid hex, MongoDB won't be able to use them as ObjectIDs.
    // However, for new modules/materials, the backend should ideally generate IDs if missing.
    // Let's ensure new items don't have IDs that look like ObjectIDs but aren't.
    
    const preparedCourse = {
        ...currentCourse,
        title: courseData.title,
        description: courseData.description,
        is_public: courseData.is_public,
        instructor_name: courseData.instructor_name,
        instructor_bio: courseData.instructor_bio,
        modules: courseData.modules.map((mod, modIdx) => ({
            ...mod,
            order: modIdx,
            // If it's a temporary ID (starts with mod_), omit it so backend generates a real one
            id: mod.id.startsWith('mod_') ? undefined : mod.id,
            materials: (mod.materials || []).map((mat, matIdx) => ({
                ...mat,
                order: matIdx,
                id: mat.id.startsWith('mat_') ? undefined : mat.id
            }))
        }))
    };

    const success = await updateCourse(courseId, preparedCourse);
    if (success) {
        setSnackbar({ open: true, message: 'Course saved successfully!', severity: 'success' });
    } else {
        setSnackbar({ open: true, message: 'Failed to save course.', severity: 'error' });
    }
  };

  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTimeLeft, setUploadTimeLeft] = useState('');

  const handleFileUpload = async (file, type) => {
    if (!file) return;

    setUploadingFile(true);
    setUploadProgress(0);
    setUploadTimeLeft('');
    const startTime = Date.now();

    try {
      const bucket = type === 'video' ? 'bol-lms-videos' : 'bol-lms-documents';
      const objectName = `uploads/${Date.now()}_${file.name}`;

      // 1. Get presigned URL
      const { data } = await api.post('/api/courses/presign', {
        bucket,
        object_name: objectName,
        expiry_mins: 15
      });

      // 2. Upload to MinIO
      await axios.put(data.url, file, {
        headers: {
          'Content-Type': file.type
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
            
            const timeElapsed = (Date.now() - startTime) / 1000;
            if (timeElapsed > 1 && progressEvent.loaded > 0) {
              const uploadSpeed = progressEvent.loaded / timeElapsed;
              const bytesRemaining = progressEvent.total - progressEvent.loaded;
              const secsRemaining = bytesRemaining / uploadSpeed;
              if (secsRemaining > 60) {
                 setUploadTimeLeft(`${Math.floor(secsRemaining / 60)}m ${Math.round(secsRemaining % 60)}s left`);
              } else {
                 setUploadTimeLeft(`${Math.round(secsRemaining)}s left`);
              }
            } else {
               setUploadTimeLeft('Calculating...');
            }
          }
        }
      });

      let finalType = editingMaterial.type;
      if (finalType === 'document' || !finalType) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
          finalType = 'image';
        } else if (ext) {
          finalType = ext;
        }
      }

      // 3. Update material
      setEditingMaterial({ 
        ...editingMaterial, 
        title: editingMaterial.title === 'New DOCUMENT' || !editingMaterial.title ? file.name : editingMaterial.title, 
        file_key: data.object_name,
        type: finalType
      });
      
      setSnackbar({ open: true, message: 'File uploaded successfully!', severity: 'success' });
    } catch (err) {
      console.error('Upload failed:', err);
      setSnackbar({ open: true, message: 'File upload failed.', severity: 'error' });
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading && !courseData.title) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={() => navigate('/dashboard/courses')}><BackIcon /></IconButton>
            <Typography variant="h4" fontWeight="bold">Course Builder</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
            <Button 
                variant="outlined" 
                color="secondary" 
                onClick={() => navigate(`/dashboard/courses/${courseId}/assessments`)}
                disabled={loading || !courseId}
            >
                View Assessments
            </Button>
            <Button 
                variant="contained" 
                color="primary" 
                startIcon={<SaveIcon />} 
                onClick={handleSaveCourse}
                disabled={loading}
            >
                {loading ? 'Saving...' : 'Save Course'}
            </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Paper elevation={2} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <TextField 
          fullWidth 
          label="Course Title" 
          variant="outlined" 
          value={courseData.title}
          onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
          sx={{ mb: 3 }}
        />
        <TextField 
          fullWidth 
          label="Course Description" 
          variant="outlined" 
          multiline
          rows={3}
          value={courseData.description}
          onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
          sx={{ mb: 3 }}
        />
        <TextField 
          fullWidth 
          label="Instructor Name" 
          variant="outlined" 
          value={courseData.instructor_name}
          onChange={(e) => setCourseData({ ...courseData, instructor_name: e.target.value })}
          placeholder="e.g. Dr. Jane Smith"
          sx={{ mb: 3 }}
        />
        <TextField 
          fullWidth 
          label="Instructor Bio" 
          variant="outlined" 
          multiline
          rows={2}
          value={courseData.instructor_bio}
          onChange={(e) => setCourseData({ ...courseData, instructor_bio: e.target.value })}
          placeholder="Brief bio about the instructor..."
          sx={{ mb: 2 }}
        />
        <FormControlLabel
          control={<Switch checked={courseData.is_public} onChange={(e) => setCourseData({ ...courseData, is_public: e.target.checked })} color="primary" />}
          label={courseData.is_public ? "Public Course (Available to all users across organizations)" : "Private Course (Available only within your organization)"}
        />
      </Paper>

      <Typography variant="h5" fontWeight="bold" gutterBottom>Modules</Typography>
      
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={courseData.modules.map(m => m.id)} strategy={verticalListSortingStrategy}>
          {courseData.modules.map((mod) => (
            <SortableModule 
              key={mod.id} 
              mod={mod} 
              onDelete={deleteModule} 
              onAddMaterial={addMaterial} 
              onDeleteMaterial={deleteMaterial}
              onEditMaterial={openEditMaterial}
              onEditModuleTitle={editModuleTitle}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }} fullWidth onClick={addModule}>
        Add New Module
      </Button>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Content: {editingMaterial?.type.toUpperCase()}</DialogTitle>
        <DialogContent dividers>
          {editingMaterial && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField 
                label="Title" 
                fullWidth 
                value={editingMaterial.title} 
                onChange={(e) => setEditingMaterial({ ...editingMaterial, title: e.target.value })} 
              />
              
              {editingMaterial.type === 'video' && (
                <Box>
                  <TextField 
                    label="YouTube URL / Video Key" 
                    fullWidth 
                    value={editingMaterial.file_key || ''} 
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, file_key: e.target.value })} 
                    helperText="Paste YouTube Video URL or enter MinIO storage key"
                    sx={{ mb: 2 }}
                  />
                  <Button variant="outlined" component="label" size="small" disabled={uploadingFile} sx={{ minWidth: 200 }}>
                    {uploadingFile ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <AddIcon sx={{ mr: 1 }} />}
                    {uploadingFile ? `Uploading ${uploadProgress}% (${uploadTimeLeft})` : 'Upload Custom Video'}
                    <input type="file" hidden accept="video/*" onChange={(e) => handleFileUpload(e.target.files[0], 'video')} />
                  </Button>
                </Box>
              )}

              {editingMaterial.type === 'text' && (
                <TextField 
                  label="Content" 
                  fullWidth 
                  multiline 
                  rows={10}
                  value={editingMaterial.content || ''} 
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, content: e.target.value })} 
                />
              )}

              {editingMaterial.type === 'quiz' && (
                <QuizEditor 
                  material={editingMaterial} 
                  courseId={courseId} 
                  moduleId={editingModuleId} 
                  onSave={(quizId) => {
                    setEditingMaterial({...editingMaterial, file_key: quizId, title: editingMaterial.title});
                    setSnackbar({ open: true, message: 'Quiz saved. Click Update Content to close.', severity: 'success' });
                  }} 
                />
              )}

              {editingMaterial.type === 'assignment' && (
                <AssignmentEditor 
                  material={editingMaterial} 
                  courseId={courseId} 
                  moduleId={editingModuleId} 
                  onSave={(assignmentId) => {
                    setEditingMaterial({...editingMaterial, file_key: assignmentId, title: editingMaterial.title});
                    setSnackbar({ open: true, message: 'Assignment saved. Click Update Content to close.', severity: 'success' });
                  }} 
                />
              )}

              {editingMaterial.type !== 'video' && editingMaterial.type !== 'text' && editingMaterial.type !== 'quiz' && editingMaterial.type !== 'assignment' && (
                <Box>
                   <TextField 
                      label="File Key" 
                      fullWidth 
                      value={editingMaterial.file_key || ''} 
                      onChange={(e) => setEditingMaterial({ ...editingMaterial, file_key: e.target.value })} 
                      helperText="Specify the storage key for this file"
                   />
                   <Box sx={{ mt: 2 }}>
                     <Button variant="outlined" component="label" size="small" disabled={uploadingFile} sx={{ minWidth: 200 }}>
                        {uploadingFile ? <CircularProgress size={20} sx={{ mr: 1 }} /> : <AddIcon sx={{ mr: 1 }} />}
                        {uploadingFile ? `Uploading ${uploadProgress}% (${uploadTimeLeft})` : (editingMaterial.file_key ? 'Replace File' : 'Upload File')}
                        <input 
                          type="file" 
                          hidden 
                          accept={{
                            video: 'video/*',
                            pdf: '.pdf',
                            docx: '.doc,.docx',
                            xlsx: '.xls,.xlsx',
                            pptx: '.ppt,.pptx',
                            image: 'image/*',
                            document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*'
                          }[editingMaterial.type] || '*'}
                          onChange={(e) => handleFileUpload(e.target.files[0], editingMaterial.type)} 
                        />
                     </Button>
                   </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveEditedMaterial} variant="contained">Update Content</Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CourseBuilder;
