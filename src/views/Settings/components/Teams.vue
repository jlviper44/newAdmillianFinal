<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';

const { user } = useAuth();
const loading = ref(true);
const team = ref(null);
const isAdmin = ref(false);
const editDialog = ref(false);
const bulkAddDialog = ref(false);
const changeOwnerDialog = ref(false);
const deleteTeamDialog = ref(false);
const removeMemberDialog = ref(false);
const memberToRemove = ref(null);
const allTeams = ref([]);
const showAllTeams = ref(false);
const bulkEmails = ref('');
const newOwnerId = ref('');
const selectedTeam = ref(null); // For admin operations on any team
const selectedMember = ref(null); // For admin operations on team members

// Feedback dialog
const feedbackDialog = ref(false);
const feedbackTitle = ref('');
const feedbackMessage = ref('');
const feedbackType = ref('info'); // 'success', 'error', 'warning', 'info'

// Form data
const teamForm = ref({
  name: '',
  description: '',
  ownerEmail: '',
  memberEmails: ''
});

// Computed property to get team owner
const teamOwner = computed(() => {
  if (!team.value || !team.value.members) return null;
  return team.value.members.find(m => m.user_id === team.value.owner_id);
});

// Computed property to check if user is in a team
const userHasTeam = computed(() => !!team.value);

// Helper function to show feedback
function showFeedback(title, message, type = 'info') {
  feedbackTitle.value = title;
  feedbackMessage.value = message;
  feedbackType.value = type;
  feedbackDialog.value = true;
}

// Fetch user's team
async function fetchUserTeam() {
  try {
    loading.value = true;
    const response = await fetch('/api/teams/my-team', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      team.value = data.team;
      isAdmin.value = data.isAdmin;
      
      if (team.value) {
        teamForm.value.name = team.value.name;
        teamForm.value.description = team.value.description || '';
      }
    }
  } catch (error) {
    console.error('Error fetching team:', error);
  } finally {
    loading.value = false;
  }
}

// Fetch all teams (admin only)
async function fetchAllTeams() {
  if (!isAdmin.value) return;
  
  try {
    const response = await fetch('/api/teams', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      allTeams.value = data.teams;
    }
  } catch (error) {
    console.error('Error fetching all teams:', error);
  }
}

// Create new team
async function createTeam() {
  try {
    const response = await fetch('/api/teams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(teamForm.value)
    });
    
    if (response.ok) {
      const result = await response.json();
      editDialog.value = false;
      
      // Show feedback about member addition if there were any attempts
      if (result.memberResults && (result.memberResults.failed.length > 0 || result.memberResults.added.length > 0)) {
        let message = 'Team created successfully!\n\n';
        
        if (result.memberResults.added.length > 0) {
          message += `Added ${result.memberResults.added.length} members.\n`;
        }
        
        if (result.memberResults.failed.length > 0) {
          message += `\nCould not add ${result.memberResults.failed.length} members:\n`;
          result.memberResults.failed.forEach(f => {
            message += `- ${f.email}: ${f.reason}\n`;
          });
          message += '\nYou can add these members manually after they create accounts.';
        }
        
        showFeedback('Team Created', message, 'success');
      } else {
        showFeedback('Team Created', 'Team created successfully!', 'success');
      }
      
      // Reset form
      teamForm.value = {
        name: '',
        description: '',
        ownerEmail: '',
        memberEmails: ''
      };
      
      await fetchUserTeam();
      await fetchAllTeams();
    } else {
      const error = await response.json();
      showFeedback('Error', error.error || 'Failed to create team', 'error');
    }
  } catch (error) {
    console.error('Error creating team:', error);
    showFeedback('Error', 'Failed to create team', 'error');
  }
}

// Update team
async function updateTeam() {
  const teamToUpdate = selectedTeam.value || team.value;
  if (!teamToUpdate) return;
  
  try {
    const response = await fetch(`/api/teams/${teamToUpdate.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(teamForm.value)
    });
    
    if (response.ok) {
      editDialog.value = false;
      selectedTeam.value = null;
      await fetchUserTeam();
      await fetchAllTeams();
    } else {
      const error = await response.json();
      showFeedback('Error', error.error || 'Failed to update team', 'error');
    }
  } catch (error) {
    console.error('Error updating team:', error);
    showFeedback('Error', 'Failed to update team', 'error');
  }
}

// Remove member from team
async function removeMember() {
  const teamToUpdate = selectedTeam.value || team.value;
  const memberToRemoveId = selectedMember.value || memberToRemove.value;
  if (!teamToUpdate || !memberToRemoveId) return;
  
  try {
    const userId = memberToRemoveId.user_id || memberToRemoveId.id;
    const response = await fetch(`/api/teams/${teamToUpdate.id}/members/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      removeMemberDialog.value = false;
      memberToRemove.value = null;
      selectedTeam.value = null;
      selectedMember.value = null;
      await fetchUserTeam();
      await fetchAllTeams();
    } else {
      const error = await response.json();
      showFeedback('Error', error.error || 'Failed to remove member', 'error');
    }
  } catch (error) {
    console.error('Error removing member:', error);
    showFeedback('Error', 'Failed to remove member', 'error');
  }
}

// Bulk add members
async function bulkAddMembers() {
  const teamToUpdate = selectedTeam.value || team.value;
  if (!teamToUpdate || !bulkEmails.value.trim()) return;
  
  // Parse emails from textarea (one per line or comma-separated)
  const emails = bulkEmails.value
    .split(/[\n,]/)
    .map(email => email.trim())
    .filter(email => email.length > 0);
  
  if (emails.length === 0) {
    showFeedback('Error', 'Please enter at least one email address', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/teams/${teamToUpdate.id}/bulk-members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ emails })
    });
    
    if (response.ok) {
      const result = await response.json();
      bulkAddDialog.value = false;
      bulkEmails.value = '';
      selectedTeam.value = null;
      
      // Show results
      let message = '';
      if (result.results.added.length > 0) {
        message += `Added: ${result.results.added.length} members\n`;
      }
      if (result.results.failed.length > 0) {
        message += `Failed: ${result.results.failed.length}\n`;
        result.results.failed.forEach(f => {
          message += `  - ${f.email}: ${f.reason}\n`;
        });
      }
      if (result.results.alreadyInTeam.length > 0) {
        message += `Already in team: ${result.results.alreadyInTeam.length}`;
      }
      
      showFeedback('Bulk Add Results', message || 'Operation completed', result.results.failed.length > 0 ? 'warning' : 'success');
      await fetchUserTeam();
      await fetchAllTeams();
    } else {
      const error = await response.json();
      showFeedback('Error', error.error || 'Failed to add members', 'error');
    }
  } catch (error) {
    console.error('Error bulk adding members:', error);
    showFeedback('Error', 'Failed to add members', 'error');
  }
}

// Change team owner
async function changeTeamOwner() {
  if (!team.value || !newOwnerId.value) return;
  
  try {
    const response = await fetch(`/api/teams/${team.value.id}/owner`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ ownerId: newOwnerId.value })
    });
    
    if (response.ok) {
      changeOwnerDialog.value = false;
      newOwnerId.value = '';
      await fetchUserTeam();
    } else {
      const error = await response.json();
      showFeedback('Error', error.error || 'Failed to change owner', 'error');
    }
  } catch (error) {
    console.error('Error changing owner:', error);
    showFeedback('Error', 'Failed to change owner', 'error');
  }
}

// Delete team
async function deleteTeam() {
  const teamToDelete = selectedTeam.value || team.value;
  if (!teamToDelete) return;
  
  try {
    const response = await fetch(`/api/teams/${teamToDelete.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      deleteTeamDialog.value = false;
      if (teamToDelete.id === team.value?.id) {
        team.value = null;
      }
      selectedTeam.value = null;
      await fetchUserTeam();
      await fetchAllTeams();
    } else {
      const error = await response.json();
      showFeedback('Error', error.error || 'Failed to delete team', 'error');
    }
  } catch (error) {
    console.error('Error deleting team:', error);
    showFeedback('Error', 'Failed to delete team', 'error');
  }
}

// Open edit dialog
function openEditDialog() {
  if (team.value) {
    teamForm.value.name = team.value.name;
    teamForm.value.description = team.value.description || '';
    teamForm.value.ownerEmail = '';
    teamForm.value.memberEmails = '';
  } else {
    teamForm.value = { 
      name: '', 
      description: '', 
      ownerEmail: user.value?.email || '',  // Default to current user's email
      memberEmails: '' 
    };
  }
  editDialog.value = true;
}

// Open remove member dialog
function openRemoveMemberDialog(member) {
  memberToRemove.value = member;
  removeMemberDialog.value = true;
}

// Admin functions for managing any team
function editTeamById(teamToEdit) {
  selectedTeam.value = teamToEdit;
  teamForm.value.name = teamToEdit.name;
  teamForm.value.description = teamToEdit.description || '';
  editDialog.value = true;
}

function openBulkAddForTeam(teamToEdit) {
  selectedTeam.value = teamToEdit;
  bulkAddDialog.value = true;
}

function openDeleteDialogForTeam(teamToDelete) {
  selectedTeam.value = teamToDelete;
  deleteTeamDialog.value = true;
}

function openRemoveMemberDialogForTeam(teamToEdit, member) {
  selectedTeam.value = teamToEdit;
  selectedMember.value = member;
  removeMemberDialog.value = true;
}

onMounted(async () => {
  await fetchUserTeam();
  if (isAdmin.value) {
    await fetchAllTeams();
    // Auto-show all teams for admins
    showAllTeams.value = true;
  }
});
</script>

<template>
  <v-card>
    <v-card-title class="d-flex justify-space-between align-center">
      <div>
        <v-icon icon="mdi-account-group" class="mr-2"></v-icon>
        Teams
      </div>
      <div v-if="isAdmin">
        <v-btn
          v-if="!userHasTeam"
          color="primary"
          @click="openEditDialog"
          prepend-icon="mdi-plus"
        >
          Create Team
        </v-btn>
        <v-btn
          v-else
          variant="text"
          @click="showAllTeams = !showAllTeams"
          :prepend-icon="showAllTeams ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        >
          {{ showAllTeams ? 'Hide' : 'Show' }} All Teams
        </v-btn>
      </div>
    </v-card-title>
    
    <v-card-text>
      <v-progress-linear v-if="loading" indeterminate color="primary"></v-progress-linear>
      
      <template v-else>
        <!-- User's Team -->
        <div v-if="team">
          <v-row>
            <v-col cols="12">
              <h3 class="text-h6 mb-2">Your Team</h3>
              <v-card variant="outlined" class="pa-4">
                <div class="d-flex justify-space-between align-start mb-4">
                  <div>
                    <h4 class="text-h5">{{ team.name }}</h4>
                    <p v-if="team.description" class="text-body-2 text-grey-darken-1 mt-1">
                      {{ team.description }}
                    </p>
                    <div class="mt-2">
                      <p class="text-caption text-grey">
                        {{ team.member_count }} member{{ team.member_count !== 1 ? 's' : '' }}
                      </p>
                      <p v-if="teamOwner" class="text-caption text-grey">
                        Owner: {{ teamOwner.user_name || teamOwner.user_email }}
                        <v-btn
                          v-if="isAdmin"
                          variant="text"
                          size="x-small"
                          icon="mdi-account-convert"
                          @click="changeOwnerDialog = true"
                          title="Change owner"
                        ></v-btn>
                      </p>
                    </div>
                  </div>
                  <div v-if="isAdmin">
                    <v-btn
                      variant="text"
                      icon="mdi-pencil"
                      size="small"
                      @click="openEditDialog"
                    ></v-btn>
                    <v-btn
                      variant="text"
                      icon="mdi-delete"
                      size="small"
                      color="error"
                      @click="deleteTeamDialog = true"
                    ></v-btn>
                  </div>
                </div>
                
                <v-divider class="mb-4"></v-divider>
                
                <div class="d-flex justify-space-between align-center mb-3">
                  <h4 class="text-subtitle-1">Team Members</h4>
                  <v-btn
                    v-if="isAdmin"
                    size="small"
                    color="primary"
                    variant="tonal"
                    prepend-icon="mdi-account-multiple-plus"
                    @click="bulkAddDialog = true"
                  >
                    Add Members
                  </v-btn>
                </div>
                
                <v-list density="compact">
                  <v-list-item
                    v-for="member in team.members"
                    :key="member.user_id"
                    :title="member.user_name || member.user_email"
                    :subtitle="member.user_email"
                  >
                    <template v-slot:append>
                      <div class="d-flex align-center gap-2">
                        <v-chip
                          v-if="member.user_id === team?.owner_id"
                          color="amber"
                          size="small"
                          variant="tonal"
                        >
                          <v-icon start size="x-small">mdi-crown</v-icon>
                          Owner
                        </v-chip>
                        <v-chip
                          v-if="member.user_id === user?.id"
                          color="primary"
                          size="small"
                          variant="tonal"
                        >
                          You
                        </v-chip>
                        <v-btn
                          v-if="isAdmin && member.user_id !== user?.id"
                          variant="text"
                          icon="mdi-account-remove"
                          size="small"
                          color="error"
                          @click="openRemoveMemberDialog(member)"
                        ></v-btn>
                      </div>
                    </template>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>
          </v-row>
        </div>
        
        <!-- No Team Message -->
        <v-alert
          v-else
          type="info"
          variant="tonal"
          class="mb-4"
        >
          <div class="d-flex align-center">
            <div>
              <div class="text-subtitle-1">You're not part of any team yet</div>
              <div class="text-body-2 mt-1">
                {{ isAdmin ? 'Create a team to start collaborating with others.' : 'Contact an admin to be added to a team.' }}
              </div>
            </div>
          </div>
        </v-alert>
        
        <!-- All Teams (Admin Only) -->
        <v-expand-transition>
          <div v-if="isAdmin && showAllTeams && allTeams.length > 0" class="mt-6">
            <h3 class="text-h6 mb-3">All Teams</h3>
            <v-row>
              <v-col
                v-for="t in allTeams"
                :key="t.id"
                cols="12"
              >
                <v-card variant="outlined" class="pa-4">
                  <div class="d-flex justify-space-between align-start mb-4">
                    <div>
                      <h4 class="text-h5">{{ t.name }}</h4>
                      <p v-if="t.description" class="text-body-2 text-grey-darken-1 mt-1">
                        {{ t.description }}
                      </p>
                      <div class="mt-2">
                        <p class="text-caption text-grey">
                          {{ t.member_count }} member{{ t.member_count !== 1 ? 's' : '' }}
                        </p>
                        <p v-if="t.members && t.members.find(m => m.id === t.owner_id)" class="text-caption text-grey">
                          Owner: {{ t.members.find(m => m.id === t.owner_id).name || t.members.find(m => m.id === t.owner_id).email }}
                        </p>
                      </div>
                    </div>
                    <div>
                      <v-btn
                        variant="text"
                        icon="mdi-pencil"
                        size="small"
                        @click="editTeamById(t)"
                      ></v-btn>
                      <v-btn
                        variant="text"
                        icon="mdi-account-multiple-plus"
                        size="small"
                        color="primary"
                        @click="openBulkAddForTeam(t)"
                      ></v-btn>
                      <v-btn
                        variant="text"
                        icon="mdi-delete"
                        size="small"
                        color="error"
                        @click="openDeleteDialogForTeam(t)"
                      ></v-btn>
                    </div>
                  </div>
                  
                  <v-divider class="mb-4"></v-divider>
                  
                  <div class="mb-3">
                    <h4 class="text-subtitle-1">Team Members</h4>
                  </div>
                  
                  <v-list density="compact">
                    <v-list-item
                      v-for="member in t.members"
                      :key="member.id"
                      :title="member.name || member.email"
                      :subtitle="member.email"
                    >
                      <template v-slot:append>
                        <div class="d-flex align-center gap-2">
                          <v-chip
                            v-if="member.id === t.owner_id"
                            color="amber"
                            size="small"
                            variant="tonal"
                          >
                            <v-icon start size="x-small">mdi-crown</v-icon>
                            Owner
                          </v-chip>
                          <v-btn
                            variant="text"
                            icon="mdi-account-remove"
                            size="small"
                            color="error"
                            @click="openRemoveMemberDialogForTeam(t, member)"
                          ></v-btn>
                        </div>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-expand-transition>
      </template>
    </v-card-text>
  </v-card>
  
  <!-- Edit/Create Team Dialog -->
  <v-dialog v-model="editDialog" max-width="500">
    <v-card>
      <v-card-title>
        {{ selectedTeam || team ? 'Edit Team' : 'Create Team' }}
      </v-card-title>
      <v-card-text>
        <v-form>
          <v-text-field
            v-model="teamForm.name"
            label="Team Name"
            required
            variant="outlined"
            density="comfortable"
          ></v-text-field>
          <v-textarea
            v-model="teamForm.description"
            label="Description (optional)"
            rows="3"
            variant="outlined"
            density="comfortable"
          ></v-textarea>
          
          <!-- Only show these fields when creating a new team -->
          <template v-if="!team && !selectedTeam">
            <v-divider class="my-4"></v-divider>
            
            <v-text-field
              v-model="teamForm.ownerEmail"
              label="Team Owner Email"
              type="email"
              variant="outlined"
              density="comfortable"
              hint="Email of the user who will own this team (defaults to you)"
              persistent-hint
            ></v-text-field>
            
            <v-textarea
              v-model="teamForm.memberEmails"
              label="Team Members (optional)"
              placeholder="member1@example.com&#10;member2@example.com&#10;member3@example.com"
              rows="5"
              variant="outlined"
              density="comfortable"
              hint="Enter email addresses of team members, one per line or comma-separated"
              persistent-hint
            ></v-textarea>
          </template>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="editDialog = false; selectedTeam = null">Cancel</v-btn>
        <v-btn
          color="primary"
          @click="(selectedTeam || team) ? updateTeam() : createTeam()"
          :disabled="!teamForm.name"
        >
          {{ (selectedTeam || team) ? 'Update' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Delete Team Dialog -->
  <v-dialog v-model="deleteTeamDialog" max-width="400">
    <v-card>
      <v-card-title>Delete Team</v-card-title>
      <v-card-text>
        <v-alert type="warning" variant="tonal" class="mb-4">
          <strong>Warning:</strong> This action cannot be undone!
        </v-alert>
        <p>Deleting this team will:</p>
        <ul class="ml-6 mt-2">
          <li>Remove all team members from the team</li>
          <li>Each member will retain all their comment groups and orders</li>
          <li>Members will no longer see each other's work</li>
        </ul>
        <p class="mt-3">Are you sure you want to continue?</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="deleteTeamDialog = false; selectedTeam = null">Cancel</v-btn>
        <v-btn color="error" @click="deleteTeam">Delete</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Remove Member Dialog -->
  <v-dialog v-model="removeMemberDialog" max-width="400">
    <v-card>
      <v-card-title>Remove Team Member</v-card-title>
      <v-card-text>
        <p>Are you sure you want to remove <strong>{{ (selectedMember || memberToRemove)?.user_name || (selectedMember || memberToRemove)?.name || (selectedMember || memberToRemove)?.user_email || (selectedMember || memberToRemove)?.email }}</strong> from the team?</p>
        <v-alert type="info" variant="tonal" class="mt-3">
          <p class="text-body-2 mb-0">After removal:</p>
          <ul class="ml-4 mt-1 text-body-2">
            <li>They will keep all their comment groups and orders</li>
            <li>They will no longer see other team members' work</li>
            <li>Other team members will no longer see their work</li>
          </ul>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="removeMemberDialog = false; memberToRemove = null; selectedMember = null; selectedTeam = null">Cancel</v-btn>
        <v-btn color="error" @click="removeMember">Remove</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Bulk Add Members Dialog -->
  <v-dialog v-model="bulkAddDialog" max-width="600">
    <v-card>
      <v-card-title>Add Team Members</v-card-title>
      <v-card-text>
        <v-alert type="info" variant="tonal" class="mb-4">
          Enter email addresses, one per line or comma-separated. Users must already have accounts in the system.
        </v-alert>
        <v-textarea
          v-model="bulkEmails"
          label="Email Addresses"
          placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
          rows="10"
          variant="outlined"
          density="comfortable"
          hint="Enter one email per line or separate with commas"
        ></v-textarea>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="bulkAddDialog = false; bulkEmails = ''; selectedTeam = null">Cancel</v-btn>
        <v-btn
          color="primary"
          @click="bulkAddMembers"
          :disabled="!bulkEmails.trim()"
        >
          Add Members
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Change Owner Dialog -->
  <v-dialog v-model="changeOwnerDialog" max-width="500">
    <v-card>
      <v-card-title>Change Team Owner</v-card-title>
      <v-card-text>
        <v-alert type="warning" variant="tonal" class="mb-4">
          The new owner must be an existing team member.
        </v-alert>
        <v-select
          v-model="newOwnerId"
          :items="team?.members || []"
          :item-title="item => item.user_name || item.user_email"
          item-value="user_id"
          label="Select New Owner"
          variant="outlined"
          density="comfortable"
        >
          <template v-slot:selection="{ item }">
            {{ item.raw.user_name || item.raw.user_email }}
            <span v-if="item.raw.user_id === team?.owner_id" class="text-caption ml-2">(Current Owner)</span>
          </template>
          <template v-slot:item="{ item, props }">
            <v-list-item v-bind="props">
              <template v-slot:title>
                {{ item.raw.user_name || item.raw.user_email }}
                <span v-if="item.raw.user_id === team?.owner_id" class="text-caption ml-2">(Current Owner)</span>
              </template>
            </v-list-item>
          </template>
        </v-select>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="changeOwnerDialog = false; newOwnerId = ''">Cancel</v-btn>
        <v-btn
          color="primary"
          @click="changeTeamOwner"
          :disabled="!newOwnerId || newOwnerId === team?.owner_id"
        >
          Change Owner
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  
  <!-- Feedback Dialog -->
  <v-dialog v-model="feedbackDialog" max-width="500">
    <v-card>
      <v-card-title>
        <v-icon 
          :icon="feedbackType === 'success' ? 'mdi-check-circle' : 
                 feedbackType === 'error' ? 'mdi-alert-circle' : 
                 feedbackType === 'warning' ? 'mdi-alert' : 'mdi-information'"
          :color="feedbackType"
          class="mr-2"
        ></v-icon>
        {{ feedbackTitle }}
      </v-card-title>
      <v-card-text>
        <div style="white-space: pre-line;">{{ feedbackMessage }}</div>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn 
          :color="feedbackType === 'error' ? 'error' : 'primary'"
          @click="feedbackDialog = false"
        >
          OK
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
</style>