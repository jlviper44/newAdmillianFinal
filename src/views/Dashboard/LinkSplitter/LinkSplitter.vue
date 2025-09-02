<template>
  <v-container fluid>
    <!-- Header -->
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">Link Splitter</h1>
        <p class="text-subtitle-1">Create and manage smart URL redirects with advanced targeting and analytics</p>
      </v-col>
    </v-row>

    <!-- Stats Overview -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-grey">Total Projects</p>
                <p class="text-h5">{{ stats.totalProjects }}</p>
              </div>
              <v-icon color="primary">mdi-link-variant</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-grey">Total Clicks</p>
                <p class="text-h5">{{ stats.totalClicks }}</p>
              </div>
              <v-icon color="success">mdi-cursor-default-click</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-grey">Active Links</p>
                <p class="text-h5">{{ stats.activeLinks }}</p>
              </div>
              <v-icon color="info">mdi-pulse</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <div>
                <p class="text-caption text-grey">Conversion Rate</p>
                <p class="text-h5">{{ stats.conversionRate }}%</p>
              </div>
              <v-icon color="warning">mdi-chart-line</v-icon>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Actions Bar -->
    <v-row class="mb-4">
      <v-col cols="12">
        <v-card>
          <v-card-text>
            <div class="d-flex justify-space-between align-center">
              <v-text-field
                v-model="search"
                prepend-inner-icon="mdi-magnify"
                label="Search projects..."
                single-line
                hide-details
                clearable
                variant="outlined"
                density="compact"
                class="mr-4"
                style="max-width: 400px"
              ></v-text-field>
              <div>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  @click="createProject"
                >
                  Create Project
                </v-btn>
                <v-btn
                  variant="outlined"
                  class="ml-2"
                  prepend-icon="mdi-folder-plus"
                  @click="showGroupDialog = true"
                >
                  New Group
                </v-btn>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Groups & Projects -->
    <v-row>
      <!-- Groups Sidebar -->
      <v-col cols="12" md="3">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            Groups
            <v-btn
              icon="mdi-plus"
              size="small"
              variant="text"
              @click="showGroupDialog = true"
            ></v-btn>
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-view-grid"
              :active="!selectedGroup"
              @click="selectedGroup = null"
            >
              <v-list-item-title>All Projects</v-list-item-title>
            </v-list-item>
            <v-divider></v-divider>
            <v-list-item
              v-for="group in groups"
              :key="group.id"
              :active="selectedGroup === group.id"
              @click="selectedGroup = group.id"
            >
              <template v-slot:prepend>
                <v-icon>mdi-folder</v-icon>
              </template>
              <v-list-item-title>{{ group.name }}</v-list-item-title>
              <template v-slot:append>
                <v-chip size="x-small" variant="tonal">
                  {{ getProjectCount(group.id) }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <!-- Projects List -->
      <v-col cols="12" md="9">
        <v-card>
          <v-card-title>Projects</v-card-title>
          <v-card-text>
            <v-data-table
              :items="filteredProjects"
              :headers="projectHeaders"
              :search="search"
              :loading="loading"
              item-value="id"
            >
              <!-- Name column -->
              <template v-slot:item.name="{ item }">
                <div class="d-flex align-center">
                  <v-icon
                    :color="item.status === 'active' ? 'success' : 'grey'"
                    size="small"
                    class="mr-2"
                  >
                    mdi-circle
                  </v-icon>
                  <div>
                    <div class="font-weight-medium">{{ item.name }}</div>
                    <div class="text-caption text-grey">{{ item.main_url }}</div>
                  </div>
                </div>
              </template>

              <!-- Short Link column -->
              <template v-slot:item.custom_alias="{ item }">
                <v-chip
                  size="small"
                  @click="copyLink(item)"
                  style="cursor: pointer"
                >
                  <v-icon start size="x-small">mdi-link</v-icon>
                  /l/{{ item.custom_alias }}
                </v-chip>
              </template>

              <!-- Clicks column -->
              <template v-slot:item.click_count="{ item }">
                <div class="d-flex align-center">
                  <span>{{ item.click_count || 0 }}</span>
                  <v-icon
                    v-if="item.clicks_limit"
                    size="x-small"
                    class="ml-1"
                    :color="item.click_count >= item.clicks_limit ? 'error' : 'grey'"
                  >
                    mdi-alert-circle
                  </v-icon>
                </div>
              </template>

              <!-- Actions column -->
              <template v-slot:item.actions="{ item }">
                <v-btn
                  icon="mdi-chart-box"
                  size="small"
                  variant="text"
                  @click="viewAnalytics(item)"
                ></v-btn>
                <v-btn
                  icon="mdi-pencil"
                  size="small"
                  variant="text"
                  @click="editProject(item)"
                ></v-btn>
                <v-btn
                  icon="mdi-content-copy"
                  size="small"
                  variant="text"
                  @click="duplicateProject(item)"
                ></v-btn>
                <v-btn
                  icon="mdi-delete"
                  size="small"
                  variant="text"
                  color="error"
                  @click="deleteProject(item)"
                ></v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create/Edit Project Dialog -->
    <ProjectEditor
      v-model="showProjectDialog"
      :project="editingProject"
      :groups="groups"
      @save="saveProject"
    />

    <!-- Analytics Dialog -->
    <Analytics
      v-model="showAnalyticsDialog"
      :project="selectedProject"
    />

    <!-- Group Dialog -->
    <v-dialog v-model="showGroupDialog" max-width="500">
      <v-card>
        <v-card-title>
          {{ editingGroup ? 'Edit Group' : 'Create Group' }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="groupForm.name"
            label="Group Name"
            required
            variant="outlined"
          ></v-text-field>
          <v-textarea
            v-model="groupForm.description"
            label="Description"
            rows="3"
            variant="outlined"
          ></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="showGroupDialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="saveGroup">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteDialog.show" max-width="400">
      <v-card>
        <v-card-title>Confirm Delete</v-card-title>
        <v-card-text>
          Are you sure you want to delete "{{ deleteDialog.itemName }}"?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="deleteDialog.show = false">Cancel</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
      location="bottom right"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import ProjectEditor from './components/ProjectEditor.vue'
import Analytics from './components/Analytics.vue'
import linkSplitterAPI from '@/services/linkSplitterAPI'

export default {
  name: 'LinkSplitter',
  components: {
    ProjectEditor,
    Analytics
  },
  setup() {
    // Data
    const loading = ref(false)
    const search = ref('')
    const selectedGroup = ref(null)
    const groups = ref([])
    const projects = ref([])
    
    // Dialogs
    const showProjectDialog = ref(false)
    const showAnalyticsDialog = ref(false)
    const showGroupDialog = ref(false)
    
    // Forms
    const editingProject = ref(null)
    const selectedProject = ref(null)
    const editingGroup = ref(null)
    const groupForm = ref({
      name: '',
      description: ''
    })
    
    // Snackbar
    const snackbar = ref({
      show: false,
      text: '',
      color: 'success',
      timeout: 3000
    })
    
    // Delete Dialog
    const deleteDialog = ref({
      show: false,
      itemName: '',
      itemToDelete: null,
      deleteType: ''
    })
    
    // Stats
    const stats = ref({
      totalProjects: 0,
      totalClicks: 0,
      activeLinks: 0,
      conversionRate: 0
    })
    
    // Table headers
    const projectHeaders = [
      { title: 'Name', key: 'name', sortable: true },
      { title: 'Short Link', key: 'custom_alias', sortable: false },
      { title: 'Clicks', key: 'click_count', sortable: true },
      { title: 'Created', key: 'created_at', sortable: true },
      { title: 'Actions', key: 'actions', sortable: false, align: 'center' }
    ]
    
    // Computed
    const filteredProjects = computed(() => {
      if (!selectedGroup.value) {
        return projects.value
      }
      return projects.value.filter(p => p.group_id === selectedGroup.value)
    })
    
    // Methods
    const showNotification = (text, color = 'success') => {
      snackbar.value = {
        show: true,
        text,
        color,
        timeout: 3000
      }
    }
    
    const loadGroups = async () => {
      try {
        groups.value = await linkSplitterAPI.getGroups()
      } catch (error) {
        console.error('Error loading groups:', error)
        showNotification('Failed to load groups', 'error')
      }
    }
    
    const loadProjects = async () => {
      loading.value = true
      try {
        projects.value = await linkSplitterAPI.getProjects()
        updateStats()
      } catch (error) {
        console.error('Error loading projects:', error)
        showNotification('Failed to load projects', 'error')
      } finally {
        loading.value = false
      }
    }
    
    const updateStats = () => {
      stats.value.totalProjects = projects.value.length
      stats.value.totalClicks = projects.value.reduce((sum, p) => sum + (p.click_count || 0), 0)
      stats.value.activeLinks = projects.value.filter(p => p.status === 'active').length
      stats.value.conversionRate = 0 // Will be calculated from analytics
    }
    
    const getProjectCount = (groupId) => {
      return projects.value.filter(p => p.group_id === groupId).length
    }
    
    const createProject = () => {
      editingProject.value = null
      showProjectDialog.value = true
    }
    
    const editProject = (project) => {
      editingProject.value = project
      showProjectDialog.value = true
    }
    
    const saveProject = async (projectData) => {
      try {
        if (editingProject.value) {
          await linkSplitterAPI.updateProject(editingProject.value.id, projectData)
          showNotification('Project updated successfully')
        } else {
          await linkSplitterAPI.createProject(projectData)
          showNotification('Project created successfully')
        }
        await loadProjects()
        showProjectDialog.value = false
      } catch (error) {
        console.error('Error saving project:', error)
        showNotification('Failed to save project', 'error')
      }
    }
    
    const duplicateProject = async (project) => {
      try {
        await linkSplitterAPI.duplicateProject(project.id, {
          name: `${project.name} (Copy)`
        })
        await loadProjects()
        showNotification('Project duplicated successfully')
      } catch (error) {
        console.error('Error duplicating project:', error)
        showNotification('Failed to duplicate project', 'error')
      }
    }
    
    const deleteProject = async (project) => {
      deleteDialog.value = {
        show: true,
        itemName: project.name,
        itemToDelete: project,
        deleteType: 'project'
      }
    }
    
    const confirmDelete = async () => {
      try {
        if (deleteDialog.value.deleteType === 'project') {
          await linkSplitterAPI.deleteProject(deleteDialog.value.itemToDelete.id)
          await loadProjects()
          showNotification('Project deleted successfully')
        }
        deleteDialog.value.show = false
      } catch (error) {
        console.error('Error deleting item:', error)
        showNotification('Failed to delete item', 'error')
      }
    }
    
    const viewAnalytics = (project) => {
      selectedProject.value = project
      showAnalyticsDialog.value = true
    }
    
    const copyLink = async (project) => {
      try {
        const link = `${window.location.origin}/l/${project.custom_alias}`
        await navigator.clipboard.writeText(link)
        showNotification('Link copied to clipboard')
      } catch (error) {
        console.error('Error copying link:', error)
        showNotification('Failed to copy link', 'error')
      }
    }
    
    const saveGroup = async () => {
      try {
        if (editingGroup.value) {
          await linkSplitterAPI.updateGroup(editingGroup.value.id, groupForm.value)
          showNotification('Group updated successfully')
        } else {
          await linkSplitterAPI.createGroup(groupForm.value)
          showNotification('Group created successfully')
        }
        await loadGroups()
        showGroupDialog.value = false
        groupForm.value = { name: '', description: '' }
      } catch (error) {
        console.error('Error saving group:', error)
        showNotification('Failed to save group', 'error')
      }
    }
    
    // Lifecycle
    onMounted(() => {
      loadGroups()
      loadProjects()
    })
    
    return {
      loading,
      search,
      selectedGroup,
      groups,
      projects,
      filteredProjects,
      showProjectDialog,
      showAnalyticsDialog,
      showGroupDialog,
      editingProject,
      selectedProject,
      editingGroup,
      groupForm,
      snackbar,
      deleteDialog,
      stats,
      projectHeaders,
      getProjectCount,
      createProject,
      editProject,
      saveProject,
      duplicateProject,
      deleteProject,
      confirmDelete,
      viewAnalytics,
      copyLink,
      saveGroup,
      loadGroups,
      loadProjects,
      showNotification
    }
  }
}
</script>