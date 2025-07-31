<template>
  <v-container fluid class="campaigns-container pa-4">
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-end">
          <v-btn 
            color="primary" 
            @click="openCreateModal"
            class="elevation-0"
            :size="$vuetify.display.smAndDown ? 'small' : 'default'"
          >
            <v-icon :class="$vuetify.display.smAndDown ? '' : 'mr-2'">mdi-plus</v-icon>
            <span :class="{ 'd-none': $vuetify.display.xs }">Create Campaign</span>
          </v-btn>
        </div>
      </v-col>
    </v-row>
    
    <!-- Search and Filters -->
    <v-card class="mb-4">
      <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
        <v-row align="center" :dense="$vuetify.display.smAndDown">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="searchQuery"
              label="Search campaigns"
              append-icon="mdi-magnify"
              hide-details
              @keyup.enter="searchCampaigns"
              placeholder="Search by name or ID..."
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="statusFilter"
              label="Status"
              :items="[
                { title: 'All Status', value: 'all' },
                { title: 'Draft', value: 'draft' },
                { title: 'Active', value: 'active' },
                { title: 'Paused', value: 'paused' },
                { title: 'Completed', value: 'completed' }
              ]"
              hide-details
              @update:model-value="searchCampaigns"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            ></v-select>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="regionFilter"
              label="Region"
              :items="[
                { title: 'All Regions', value: 'all' },
                { title: 'United States', value: 'US' },
                { title: 'United Kingdom', value: 'UK' },
                { title: 'Canada', value: 'CA' },
                { title: 'Germany', value: 'DE' },
                { title: 'Australia', value: 'AU' },
                { title: 'New Zealand', value: 'NZ' },
                { title: 'Czech Republic', value: 'CZ' },
                { title: 'Slovakia', value: 'SK' }
              ]"
              hide-details
              @update:model-value="searchCampaigns"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            ></v-select>
          </v-col>
          <v-col cols="12" md="2">
            <v-btn 
              color="primary" 
              @click="searchCampaigns" 
              :class="$vuetify.display.smAndDown ? '' : 'ml-2'"
              :block="$vuetify.display.smAndDown"
              :size="$vuetify.display.smAndDown ? 'small' : 'default'"
            >
              Search
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
    
    <!-- Bulk Actions Menu -->
    <v-card 
      class="mb-4"
      variant="flat"
    >
      <v-card-text class="pa-3">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center gap-3">
            <v-btn
              :color="selectedCampaigns.length === campaigns.length && campaigns.length > 0 ? 'primary' : 'default'"
              :variant="selectedCampaigns.length === campaigns.length && campaigns.length > 0 ? 'tonal' : 'outlined'"
              size="small"
              @click="toggleSelectAll()"
            >
              <v-icon class="mr-2" size="small">
                {{ selectedCampaigns.length === campaigns.length && campaigns.length > 0 ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}
              </v-icon>
              Select All
            </v-btn>
            
            <div v-if="selectedCampaigns.length > 0" class="d-flex align-center gap-2">
              <v-divider vertical class="mx-2" />
              <span class="text-body-2 text-medium-emphasis">
                {{ selectedCampaigns.length }} campaign{{ selectedCampaigns.length !== 1 ? 's' : '' }} selected
              </span>
            </div>
          </div>
          
          <transition
            name="slide-fade"
            mode="out-in"
          >
            <div v-if="selectedCampaigns.length > 0" class="d-flex align-center">
              <v-menu>
                <template v-slot:activator="{ props }">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    v-bind="props"
                    size="small"
                    class="mr-3"
                  >
                    <v-icon class="mr-2" size="small">mdi-tag-multiple</v-icon>
                    Set Status
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="status in ['draft', 'active', 'paused', 'completed']"
                    :key="status"
                    @click="bulkUpdateStatus(status)"
                  >
                    <template v-slot:prepend>
                      <v-icon :color="getStatusColor(status)" size="small">
                        mdi-circle
                      </v-icon>
                    </template>
                    <v-list-item-title>{{ status }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
              
              <v-btn 
                color="error" 
                variant="tonal"
                size="small"
                @click="bulkDelete"
              >
                <v-icon class="mr-2" size="small">mdi-delete</v-icon>
                Delete Selected
              </v-btn>
            </div>
          </transition>
        </div>
      </v-card-text>
    </v-card>
    
    <!-- Campaigns Grid -->
    <v-row v-if="isLoading">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        <p class="mt-2">Loading campaigns...</p>
      </v-col>
    </v-row>
    
    <v-row v-else-if="campaigns.length === 0">
      <v-col cols="12" class="text-center">
        <p class="text-grey">No campaigns found. Create your first campaign to get started.</p>
      </v-col>
    </v-row>
    
    <v-row v-else>
      <v-col 
        v-for="campaign in campaigns" 
        :key="campaign.id" 
        cols="12"
      >
        <v-card class="campaign-card mb-3" flat>
          <div class="campaign-header pa-3">
            <div class="d-flex align-center justify-space-between">
              <div class="d-flex align-center">
                <v-checkbox
                  :model-value="selectedCampaigns.includes(campaign.id)"
                  @update:model-value="toggleSelection(campaign.id)"
                  hide-details
                  density="compact"
                  class="flex-grow-0 mr-3"
                ></v-checkbox>
                
                <div class="d-flex align-center gap-2">
                  <v-select
                    :model-value="campaign.status"
                    :items="statusOptions"
                    @update:model-value="(value) => updateCampaignStatus(campaign.id, value)"
                    density="compact"
                    hide-details
                    variant="solo"
                    flat
                    style="max-width: 140px;"
                    class="campaign-status-select"
                  >
                    <template v-slot:selection="{ item }">
                      <v-chip
                        :color="getStatusColor(item.value)"
                        size="x-small"
                      >
                        {{ item.title }}
                      </v-chip>
                    </template>
                    <template v-slot:item="{ item, props }">
                      <v-list-item v-bind="props" :title="item.title" density="compact">
                        <template v-slot:prepend>
                          <v-icon :color="getStatusColor(item.value)" size="small">
                            mdi-circle
                          </v-icon>
                        </template>
                      </v-list-item>
                    </template>
                  </v-select>
                  <h3 class="text-subtitle-1 font-weight-bold">{{ campaign.name }}</h3>
                  <template v-if="campaign.sparkName">
                    <v-icon size="x-small" color="amber">mdi-lightning-bolt</v-icon>
                    <span class="text-caption text-medium-emphasis">{{ campaign.sparkName }}</span>
                  </template>
                </div>
              </div>
              
              <div class="d-flex flex-column align-end">
                <div v-if="campaign.creator" class="text-caption text-medium-emphasis">
                  Created by: {{ campaign.creator.name || campaign.creator.email }}
                </div>
              </div>
              
              <div class="d-flex gap-1 campaign-actions">
                <v-btn
                  icon
                  :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                  variant="plain"
                  @click="openLaunchesModal(campaign)"
                >
                  <v-icon :size="$vuetify.display.smAndDown ? 'small' : 'default'" color="purple">mdi-rocket-launch</v-icon>
                  <v-tooltip activator="parent" location="bottom">Manage Launches</v-tooltip>
                </v-btn>
                
                
                <v-btn
                  icon
                  :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                  variant="plain"
                  @click="openEditModal(campaign)"
                >
                  <v-icon :size="$vuetify.display.smAndDown ? 'small' : 'default'" color="primary">mdi-pencil</v-icon>
                  <v-tooltip activator="parent" location="bottom">Edit</v-tooltip>
                </v-btn>
                
                <v-btn
                  icon
                  :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                  variant="plain"
                  @click="duplicateCampaign(campaign)"
                  :class="{ 'd-none': $vuetify.display.xs }"
                >
                  <v-icon :size="$vuetify.display.smAndDown ? 'small' : 'default'" color="blue">mdi-content-copy</v-icon>
                  <v-tooltip activator="parent" location="bottom">Duplicate</v-tooltip>
                </v-btn>
                
                <v-btn
                  icon
                  :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                  variant="plain"
                  @click="confirmDelete(campaign)"
                >
                  <v-icon :size="$vuetify.display.smAndDown ? 'small' : 'default'" color="error">mdi-delete</v-icon>
                  <v-tooltip activator="parent" location="bottom">Delete</v-tooltip>
                </v-btn>
              </div>
            </div>
          </div>
          
          <v-divider></v-divider>
          
          <div class="pa-3">
            <v-row>
              <!-- Stores Section -->
              <v-col cols="12" sm="6" md="3">
                <div class="info-section">
                  <div class="section-title mb-2">
                    <v-icon size="small" class="mr-1">mdi-store</v-icon>
                    Stores
                  </div>
                  <div class="store-item mb-2">
                    <div class="store-value flex-wrap">
                      <div class="d-flex align-center">
                        <v-icon size="x-small" color="primary" class="mr-1">mdi-shopping</v-icon>
                        <span class="text-medium-emphasis">TikTok Shop:</span>
                      </div>
                      <span class="ml-1 text-break">{{ campaign.tiktokStoreName || campaign.tiktokStoreId || 'Not configured' }}</span>
                    </div>
                  </div>
                  <div class="store-item">
                    <div class="store-value flex-wrap">
                      <div class="d-flex align-center">
                        <v-icon size="x-small" color="secondary" class="mr-1">mdi-store</v-icon>
                        <span class="text-medium-emphasis">Redirect Store:</span>
                      </div>
                      <span class="ml-1 text-break">{{ campaign.redirectStoreName || campaign.redirectStoreId || 'Not configured' }}</span>
                      <v-icon v-if="campaign.redirectType === 'custom'" size="x-small" color="orange" class="ml-1">
                        mdi-open-in-new
                      </v-icon>
                    </div>
                  </div>
                </div>
              </v-col>
              
              <!-- Regions Section -->
              <v-col cols="12" sm="6" md="3">
                <div class="info-section">
                  <div class="section-title mb-2">
                    <v-icon size="small" class="mr-1">mdi-earth</v-icon>
                    Target Regions
                  </div>
                  <div v-if="campaign.regions && campaign.regions.length > 0" class="regions-grid">
                    <v-chip
                      v-for="region in campaign.regions"
                      :key="region"
                      size="small"
                      color="blue"
                      variant="tonal"
                      label
                      class="mr-1 mb-1"
                    >
                      {{ getRegionDisplayName(region) }}
                    </v-chip>
                  </div>
                  <div v-else class="text-caption text-medium-emphasis">
                    No regions selected
                  </div>
                </div>
              </v-col>
              
              <!-- Template Section -->
              <v-col cols="12" sm="6" md="3">
                <div class="info-section">
                  <div class="section-title mb-2">
                    <v-icon size="small" class="mr-1">mdi-file-document</v-icon>
                    Template
                  </div>
                  <div class="text-body-2">
                    {{ getTemplateName(campaign.templateId) || 'No template selected' }}
                  </div>
                </div>
              </v-col>
              
              <!-- Stats Section -->
              <v-col cols="12" sm="6" md="3">
                <div class="stats-section">
                  <!-- Compact Traffic Indicators -->
                  <div class="traffic-row d-flex align-center gap-2 mb-2 flex-wrap">
                    <div class="traffic-indicator disabled-traffic d-flex align-center gap-1 px-2 py-1">
                      <v-icon size="x-small" color="grey">mdi-pause</v-icon>
                      <span class="text-caption">Disabled</span>
                      <span class="font-weight-medium ml-1">{{ campaign.trafficDisabled || 0 }}</span>
                    </div>
                    
                    <div class="traffic-indicator passed-traffic d-flex align-center gap-1 px-2 py-1">
                      <v-icon size="x-small" color="success">mdi-check</v-icon>
                      <span class="text-caption">Passed</span>
                      <span class="font-weight-medium ml-1">{{ campaign.trafficPassed || 0 }}</span>
                    </div>
                    
                    <div class="traffic-indicator blocked-traffic d-flex align-center gap-1 px-2 py-1">
                      <v-icon size="x-small" color="error">mdi-close</v-icon>
                      <span class="text-caption">Blocked</span>
                      <span class="font-weight-medium ml-1">{{ campaign.trafficBlocked || 0 }}</span>
                    </div>
                    
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      :loading="refreshingTraffic === campaign.id"
                      @click.stop="refreshCampaignTraffic(campaign)"
                      title="Refresh traffic"
                      class="ml-auto"
                    >
                      <v-icon size="small">mdi-refresh</v-icon>
                    </v-btn>
                  </div>
                  
                  <div class="stat-item">
                    <v-btn
                      color="purple"
                      variant="tonal"
                      size="small"
                      rounded
                      @click="openLaunchesModal(campaign)"
                      class="launches-btn"
                    >
                      <v-icon start size="small">mdi-rocket-launch</v-icon>
                      {{ getActiveLaunches(campaign) }}/{{ getTotalLaunches(campaign) }} Launches
                    </v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>
          </div>
        </v-card>
      </v-col>
    </v-row>
    
    <!-- Pagination -->
    <div class="d-flex justify-space-between align-center mt-4" v-if="campaigns.length > 0">
      <div class="text-grey">
        Showing {{ campaigns.length }} campaigns
      </div>
      <v-pagination
        v-if="totalPages > 1"
        v-model="currentPage"
        :length="totalPages"
        @update:model-value="changePage"
        rounded="circle"
      ></v-pagination>
    </div>

    <!-- Create/Edit Campaign Modal -->
    <v-dialog 
      v-model="showCreateModal" 
      :max-width="$vuetify.display.smAndDown ? '100%' : '800px'" 
      :fullscreen="$vuetify.display.smAndDown"
      scrollable
    >
      <v-card>
        <v-card-title :class="$vuetify.display.smAndDown ? 'd-flex align-center pa-3' : ''">
          <span :class="$vuetify.display.smAndDown ? 'text-body-1' : ''">
            {{ editingCampaign ? 'Edit Campaign' : 'Create Campaign' }}
          </span>
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="closeModal" :size="$vuetify.display.smAndDown ? 'small' : 'default'">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        
        <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : 'pa-4'">
          <v-form ref="campaignForm">
            <div v-if="editingCampaign && editingCampaign.creator" class="mb-4">
              <v-alert type="info" variant="tonal" density="compact">
                Created by: {{ editingCampaign.creator.name || editingCampaign.creator.email }}
              </v-alert>
            </div>
            <!-- Status at the top -->
            <v-select
              v-model="formData.status"
              label="Status"
              :items="statusOptions"
              variant="outlined"
              class="mb-4"
              :rules="[v => !!v || 'Status is required']"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            >
              <template v-slot:selection="{ item }">
                <v-chip
                  :color="getStatusColor(item.value)"
                  size="small"
                >
                  {{ item.title }}
                </v-chip>
              </template>
              <template v-slot:item="{ item, props }">
                <v-list-item v-bind="props" :title="item.title">
                  <template v-slot:prepend>
                    <v-icon :color="getStatusColor(item.value)" size="small">
                      mdi-circle
                    </v-icon>
                  </template>
                </v-list-item>
              </template>
            </v-select>

            <!-- Basic Information -->
            <v-text-field
              v-model="formData.name"
              label="Campaign Name"
              :rules="[v => !!v || 'Campaign name is required']"
              variant="outlined"
              class="mb-4"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            ></v-text-field>
            
            <v-textarea
              v-model="formData.description"
              label="Description (Optional)"
              variant="outlined"
              rows="2"
              class="mb-4"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            ></v-textarea>

            <!-- Store Configuration -->
            <v-row :dense="$vuetify.display.smAndDown">
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.tiktokStoreId"
                  label="TikTok Store"
                  :items="stores"
                  item-title="store_name"
                  item-value="id"
                  variant="outlined"
                  :rules="[v => !!v || 'TikTok store is required']"
                  :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                >
                  <template v-slot:append-inner>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      @click.stop="testStoreConnection(formData.tiktokStoreId, 'tiktok')"
                      :loading="testingConnection.tiktok"
                      :disabled="!formData.tiktokStoreId"
                    >
                      <v-icon>mdi-connection</v-icon>
                    </v-btn>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.redirectType"
                  label="Redirect Type"
                  :items="['shopify', 'custom']"
                  variant="outlined"
                  @update:model-value="onRedirectTypeChange"
                  :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                >
                  <template v-slot:item="{ item, props }">
                    <v-list-item v-bind="props">
                      <template v-slot:prepend>
                        <v-icon>{{ item.value === 'shopify' ? 'mdi-shopping' : 'mdi-open-in-new' }}</v-icon>
                      </template>
                      <v-list-item-title>{{ item.value === 'shopify' ? 'Shopify Store' : 'Custom URL' }}</v-list-item-title>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-row v-if="formData.redirectType === 'shopify'" :dense="$vuetify.display.smAndDown">
              <v-col cols="12">
                <v-select
                  v-model="formData.redirectStoreId"
                  label="Redirect Store"
                  :items="stores"
                  item-title="store_name"
                  item-value="id"
                  variant="outlined"
                  :rules="formData.redirectType === 'shopify' ? [v => !!v || 'Redirect store is required'] : []"
                  :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                >
                  <template v-slot:append-inner>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      @click.stop="testStoreConnection(formData.redirectStoreId, 'redirect')"
                      :loading="testingConnection.redirect"
                      :disabled="!formData.redirectStoreId"
                    >
                      <v-icon>mdi-connection</v-icon>
                    </v-btn>
                  </template>
                </v-select>
              </v-col>
            </v-row>

            <v-row v-else :dense="$vuetify.display.smAndDown">
              <v-col cols="12">
                <v-text-field
                  v-model="formData.customRedirectUrl"
                  label="Custom Redirect URL"
                  placeholder="https://example.com"
                  variant="outlined"
                  :rules="formData.redirectType === 'custom' ? [
                    v => !!v || 'Custom URL is required',
                    v => /^https?:\/\/.+/.test(v) || 'Invalid URL format'
                  ] : []"
                  :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
                ></v-text-field>
              </v-col>
            </v-row>

            <!-- Landing Page Template -->
            <v-select
              v-model="formData.templateId"
              label="Landing Page Template"
              :items="templates"
              item-title="name"
              item-value="id"
              variant="outlined"
              :loading="loadingTemplates"
              class="mb-4"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            >
              <template v-slot:item="{ item, props }">
                <v-list-item v-bind="props">
                  <v-list-item-subtitle>{{ item.category }}</v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-select>

            <!-- Spark Selection -->
            <v-select
              v-model="formData.sparkId"
              label="Spark (Optional)"
              :items="sparks"
              item-title="name"
              item-value="id"
              variant="outlined"
              clearable
              class="mb-4"
              :density="$vuetify.display.smAndDown ? 'compact' : 'comfortable'"
            >
              <template v-slot:item="{ item, props }">
                <v-list-item v-bind="props">
                  <template v-slot:prepend>
                    <v-icon color="yellow">mdi-lightning-bolt</v-icon>
                  </template>
                  <v-list-item-subtitle>{{ item.tiktok_url }}</v-list-item-subtitle>
                </v-list-item>
              </template>
            </v-select>

            <!-- Region Selection -->
            <div class="mb-4">
              <p class="text-subtitle-2 mb-2">Target Regions</p>
              <v-chip-group
                v-model="formData.regions"
                multiple
                selected-class="v-chip--selected"
              >
                <v-chip
                  v-for="region in availableRegions"
                  :key="region.value"
                  :value="region.value"
                  color="primary"
                  variant="tonal"
                >
                  {{ region.title }}
                </v-chip>
              </v-chip-group>
            </div>

            <!-- Affiliate Links Configuration -->
            <v-divider class="my-4"></v-divider>
            <div class="text-subtitle-1 mb-4">Affiliate Links Configuration</div>
            
            <v-expansion-panels v-model="expandedPanels" multiple>
              <v-expansion-panel
                v-for="region in formData.regions"
                :key="region"
                :value="region"
              >
                <v-expansion-panel-title>
                  <v-icon class="mr-2">mdi-earth</v-icon>
                  {{ getRegionName(region) }}
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="formData.affiliateLinks[region + '_ios']"
                        label="iOS Link"
                        placeholder="https://example.com/ios"
                        variant="outlined"
                        density="compact"
                      >
                        <template v-slot:prepend-inner>
                          <v-icon size="small">mdi-apple</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-text-field
                        v-model="formData.affiliateLinks[region + '_android']"
                        label="Android Link"
                        placeholder="https://example.com/android"
                        variant="outlined"
                        density="compact"
                      >
                        <template v-slot:prepend-inner>
                          <v-icon size="small">mdi-android</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                    <v-col cols="12">
                      <v-text-field
                        v-model="formData.affiliateLinks[region]"
                        label="Default Link (All Devices)"
                        placeholder="https://example.com/default"
                        variant="outlined"
                        density="compact"
                      >
                        <template v-slot:prepend-inner>
                          <v-icon size="small">mdi-devices</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                  </v-row>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-form>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeModal">Cancel</v-btn>
          <v-btn 
            color="primary" 
            variant="flat"
            @click="saveCampaign"
            :loading="saving"
          >
            {{ editingCampaign ? 'Update' : 'Create' }} Campaign
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Manage Launches Modal -->
    <v-dialog 
      v-model="showLaunchesModal" 
      :max-width="$vuetify.display.smAndDown ? '100%' : '800px'" 
      :fullscreen="$vuetify.display.smAndDown"
      scrollable
    >
      <v-card>
        <v-card-title :class="['border-b', $vuetify.display.smAndDown ? 'pa-3' : 'px-4 py-3']">
          <div class="d-flex justify-space-between align-center w-100">
            <div class="d-flex align-center">
              <v-icon color="purple" :class="$vuetify.display.smAndDown ? 'mr-1' : 'mr-2'" :size="$vuetify.display.smAndDown ? 'small' : 'default'">mdi-rocket-launch</v-icon>
              <span :class="$vuetify.display.smAndDown ? 'text-body-2' : ''">Manage Launches</span>
            </div>
            <div class="d-flex align-center gap-1">
              <v-btn 
                icon 
                variant="text" 
                :size="$vuetify.display.smAndDown ? 'x-small' : 'small'"
                @click="refreshCampaignTraffic(currentCampaign)"
                :loading="refreshingTraffic === currentCampaign?.id"
                title="Refresh traffic data"
              >
                <v-icon>mdi-refresh</v-icon>
              </v-btn>
              <v-btn 
                icon 
                variant="text" 
                :size="$vuetify.display.smAndDown ? 'x-small' : 'small'" 
                @click="showLaunchesModal = false" 
              >
                <v-icon>mdi-close</v-icon>
              </v-btn>
            </div>
          </div>
        </v-card-title>
        
        <v-card-text class="pa-0">
          <!-- Campaign Header Info -->
          <div class="pa-4 pb-3">
            <v-card variant="flat" class="pa-4" :class="$vuetify.theme.current.dark ? 'bg-grey-darken-3' : 'bg-grey-lighten-5'">
              <h3 class="text-subtitle-1 mb-1 font-weight-medium">{{ currentCampaign?.name }}</h3>
              <div class="text-body-2">
                <span>Campaign ID: {{ currentCampaign?.id }}</span>
                <span class="mx-2">•</span>
                <span>Total Launches: {{ currentLaunches.length }}</span>
              </div>
              
              <v-alert
                type="info"
                variant="tonal"
                density="compact"
                class="mt-3 mb-0"
              >
                <span class="text-caption">The "Generate Link" button will create/refresh the Shopify pages with the latest campaign settings.</span>
              </v-alert>
            </v-card>
          </div>

          <!-- Add New Launches Section -->
          <div class="px-4 pb-3">
            <v-card variant="flat" class="pa-4" :class="$vuetify.theme.current.dark ? 'bg-grey-darken-3' : 'bg-grey-lighten-5'">
              <div class="d-flex align-center justify-space-between">
                <h4 class="text-body-2 font-weight-medium">Add New Launches</h4>
                <div class="d-flex align-center gap-3">
                  <span class="text-body-2 font-weight-medium">Count:</span>
                  <div class="launch-count-wrapper purple-theme">
                    <button 
                      type="button"
                      class="launch-count-btn minus"
                      @click="decrementLaunchCount"
                      :disabled="newLaunchCount <= 1"
                    >
                      <v-icon size="small">mdi-minus</v-icon>
                    </button>
                    <input 
                      v-model.number="newLaunchCount"
                      type="number"
                      min="1"
                      max="10"
                      class="launch-count-input"
                      @input="validateLaunchCount"
                    />
                    <button 
                      type="button"
                      class="launch-count-btn plus"
                      @click="incrementLaunchCount"
                      :disabled="newLaunchCount >= 10"
                    >
                      <v-icon size="small">mdi-plus</v-icon>
                    </button>
                  </div>
                  <v-btn
                    color="purple"
                    variant="flat"
                    size="small"
                    @click="addNewLaunches"
                    :loading="addingLaunches"
                    prepend-icon="mdi-plus"
                    class="mx-2 my-1"
                  >
                    Add
                  </v-btn>
                </div>
              </div>
            </v-card>
          </div>

          <!-- Existing Launches -->
          <div class="px-4 pb-4">
            <h4 class="text-body-2 mb-3 font-weight-medium">Existing Launches</h4>
            
            <div v-if="currentLaunches.length === 0" class="text-center py-8">
              <v-icon size="48" color="grey">mdi-rocket</v-icon>
              <p class="text-body-1 mt-3 mb-1">No launches found</p>
              <p class="text-caption text-grey">Click "Add" above to create your first launch</p>
            </div>

            <div v-else style="max-height: 350px; overflow-y: auto; overflow-x: hidden;" class="pr-2 launches-scroll">
              <div class="d-flex flex-column ga-2">
                <v-card
                  v-for="(launch, index) in currentLaunches" 
                  :key="index"
                  :color="launch.isActive ? ($vuetify.theme.current.dark ? 'grey-darken-2' : 'grey-lighten-5') : ($vuetify.theme.current.dark ? 'grey-darken-3' : 'grey-lighten-4')"
                  :variant="launch.isActive ? 'outlined' : 'flat'"
                  :style="launch.isActive ? 'border-color: rgb(168, 85, 247);' : ''"
                  class="pa-3"
                  style="min-width: 0;"
                >
                  <div class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between ga-3">
                    <!-- Launch info -->
                    <div class="flex-grow-1" style="min-width: 0;">
                      <div class="d-flex align-center gap-2 mb-1 flex-wrap">
                        <span class="text-body-1 font-weight-medium" :class="$vuetify.theme.current.dark ? 'text-grey-lighten-2' : 'text-grey-darken-4'">
                          Launch {{ index }}
                          <span v-if="index === 0" class="text-caption ml-1">(Default)</span>
                        </span>
                        
                        <v-chip 
                          :color="launch.isActive ? 'green' : 'grey'"
                          variant="tonal"
                          size="x-small"
                        >
                          {{ launch.isActive ? 'Active' : 'Disabled' }}
                        </v-chip>
                      </div>
                      
                      <div class="text-caption" :class="$vuetify.theme.current.dark ? 'text-grey-lighten-1' : 'text-grey-darken-1'" style="word-break: break-word;">
                        <div v-if="launch.createdAt" class="mb-1">
                          Created: {{ formatDate(launch.createdAt) }}
                        </div>
                        <div v-if="launch.generatedAt">
                          <template v-if="getTimeSinceGenerated(launch.generatedAt).hours < 1">
                            <span class="text-green-darken-1">• Recently updated</span>
                          </template>
                          <template v-else-if="getTimeSinceGenerated(launch.generatedAt).hours < 24">
                            <span class="text-blue-darken-1">• Updated {{ getTimeSinceGenerated(launch.generatedAt).hours }}h ago</span>
                          </template>
                          <template v-else>
                            <span class="text-orange-darken-1">• Updated {{ getTimeSinceGenerated(launch.generatedAt).days }}d ago</span>
                          </template>
                        </div>
                        <div v-else class="text-orange-darken-1">
                          • Not generated
                        </div>
                      </div>
                    </div>

                    <!-- Action buttons and traffic stats -->
                    <div class="d-flex align-center gap-3 flex-shrink-0">
                      <!-- Traffic stats -->
                      <div class="launch-traffic-stats d-flex align-center gap-2 mr-2">
                        <div class="d-flex align-center gap-1">
                          <v-icon size="x-small" color="grey">mdi-pause</v-icon>
                          <span class="text-caption font-weight-medium">{{ launch.trafficDisabled || 0 }}</span>
                        </div>
                        <v-divider vertical class="mx-1" style="height: 16px;"></v-divider>
                        <div class="d-flex align-center gap-1">
                          <v-icon size="x-small" color="success">mdi-check</v-icon>
                          <span class="text-caption font-weight-medium">{{ launch.trafficPassed || 0 }}</span>
                        </div>
                        <v-divider vertical class="mx-1" style="height: 16px;"></v-divider>
                        <div class="d-flex align-center gap-1">
                          <v-icon size="x-small" color="error">mdi-close</v-icon>
                          <span class="text-caption font-weight-medium">{{ launch.trafficBlocked || 0 }}</span>
                        </div>
                      </div>
                      
                      <v-btn
                        color="purple"
                        variant="flat"
                        size="small"
                        @click="generateLaunchLink(index)"
                        :loading="generatingLinkFor === index"
                        :prepend-icon="launch.generatedAt ? 'mdi-refresh' : 'mdi-link'"
                        class="mx-1 my-1"
                      >
                        {{ launch.generatedAt ? 'Refresh & Copy' : 'Generate Link' }}
                      </v-btn>
                      
                      <v-btn
                        :color="launch.isActive ? 'grey' : 'green'"
                        variant="flat"
                        size="small"
                        @click="toggleLaunch(index)"
                        :loading="togglingLaunch === index"
                        :prepend-icon="launch.isActive ? 'mdi-pause' : 'mdi-play'"
                        class="mx-1 my-1"
                      >
                        {{ launch.isActive ? 'Disable' : 'Enable' }}
                      </v-btn>
                    </div>
                  </div>
                </v-card>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>


    <!-- Delete Confirmation Dialog -->
    <v-dialog 
      v-model="showDeleteDialog" 
      :max-width="$vuetify.display.smAndDown ? '100%' : '400px'"
      :fullscreen="$vuetify.display.smAndDown"
    >
      <v-card>
        <v-card-title :class="$vuetify.display.smAndDown ? 'text-body-1 pa-3' : ''">Confirm Delete</v-card-title>
        <v-card-text :class="$vuetify.display.smAndDown ? 'pa-3' : ''">
          Are you sure you want to delete "{{ deletingCampaign?.name }}"? This action cannot be undone.
        </v-card-text>
        <v-card-actions :class="$vuetify.display.smAndDown ? 'pa-3' : ''">
          <v-spacer></v-spacer>
          <v-btn 
            variant="text" 
            @click="showDeleteDialog = false"
            :size="$vuetify.display.smAndDown ? 'small' : 'default'"
          >
            Cancel
          </v-btn>
          <v-btn 
            color="error" 
            variant="flat"
            @click="deleteCampaign"
            :loading="deleting"
            :size="$vuetify.display.smAndDown ? 'small' : 'default'"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Status Menu -->
    <v-menu
      v-model="showStatusMenu"
      :target="statusMenuTarget"
      offset="10"
    >
      <v-list density="compact">
        <v-list-item
          v-for="status in ['draft', 'active', 'paused', 'completed']"
          :key="status"
          @click="updateStatus(status)"
        >
          <template v-slot:prepend>
            <v-icon :color="getStatusColor(status)" size="small">
              mdi-circle
            </v-icon>
          </template>
          <v-list-item-title>{{ status }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { campaignsApi, shopifyApi, templatesApi, sparksApi } from '@/services/api';
import logsAPI from '@/services/logsAPI';

// Snackbar state
const showSnackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

// Helper functions for notifications
const showSuccess = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'success';
  showSnackbar.value = true;
};

const showError = (message) => {
  snackbarText.value = message;
  snackbarColor.value = 'error';
  showSnackbar.value = true;
};

// Data
const campaigns = ref([]);
const stores = ref([]);
const templates = ref([]);
const sparks = ref([]);
const isLoading = ref(false);
const loadingTemplates = ref(false);
const saving = ref(false);
const deleting = ref(false);
const generatingLink = ref(false);
const testingConnection = ref({ tiktok: false, redirect: false });

// Search and filters
const searchQuery = ref('');
const statusFilter = ref('all');
const regionFilter = ref('all');
const selectedCampaigns = ref([]);
const selectAllCheckbox = ref(false);
const itemsPerPage = ref(10);
const currentPage = ref(1);
const totalPages = ref(1);

// Dialogs
const showCreateModal = ref(false);
const showDeleteDialog = ref(false);
const showLaunchesModal = ref(false);
const showStatusMenu = ref(false);
const statusMenuTarget = ref(null);

// Current items
const editingCampaign = ref(null);
const deletingCampaign = ref(null);
const currentCampaign = ref(null);
const currentLaunches = ref([]);
const generatedLink = ref('');
const expandedPanels = ref([]);

// Launch management
const newLaunchCount = ref(1);
const addingLaunches = ref(false);
const generatingLinkFor = ref(null);
const togglingLaunch = ref(null);
const refreshingTraffic = ref(null);

// Forms
const campaignForm = ref(null);
const linkForm = ref(null);

const formData = ref({
  name: '',
  description: '',
  status: 'draft',
  tiktokStoreId: '',
  redirectStoreId: '',
  redirectType: 'shopify',
  customRedirectUrl: '',
  templateId: '',
  sparkId: '',
  regions: [],
  affiliateLinks: {}
});

const linkFormData = ref({
  launchNumber: 0,
  region: 'US',
  os: 'all',
  subaffiliateId: ''
});

// Available regions
const availableRegions = [
  { title: 'United States', value: 'US' },
  { title: 'United Kingdom', value: 'UK' },
  { title: 'Canada', value: 'CA' },
  { title: 'Germany', value: 'DE' },
  { title: 'Australia', value: 'AU' },
  { title: 'New Zealand', value: 'NZ' },
  { title: 'Czech Republic', value: 'CZ' },
  { title: 'Slovakia', value: 'SK' }
];

// Region code to full name mapping
const regionNameMap = {
  'US': 'United States',
  'UK': 'United Kingdom',
  'CA': 'Canada',
  'DE': 'Germany',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'CZ': 'Czech Republic',
  'SK': 'Slovakia'
};

// Function to get region display name
const getRegionDisplayName = (regionCode) => {
  return regionNameMap[regionCode] || regionCode;
};

// Status options for select
const statusOptions = [
  { title: 'Draft', value: 'draft' },
  { title: 'Active', value: 'active' },
  { title: 'Paused', value: 'paused' },
  { title: 'Completed', value: 'completed' }
];

// Table headers
const headers = [
  { title: 'Campaign', key: 'name', sortable: true },
  { title: 'TikTok Store', key: 'tiktokStore', sortable: false },
  { title: 'Redirect Store', key: 'redirectStore', sortable: false },
  { title: 'Regions', key: 'regions', sortable: false },
  { title: 'Launches', key: 'launches', sortable: false, align: 'center' },
  { title: 'Traffic', key: 'traffic', sortable: true, align: 'center' },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Active', key: 'isActive', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' }
];

// Methods
const fetchCampaigns = async () => {
  isLoading.value = true;
  try {
    const params = {
      search: searchQuery.value,
      status: statusFilter.value,
      region: regionFilter.value,
      page: currentPage.value,
      limit: itemsPerPage.value
    };
    
    const data = await campaignsApi.listCampaigns(params);
    campaigns.value = data.campaigns || [];
    totalPages.value = data.totalPages || 1;
    
    // Fetch traffic data for all campaigns
    try {
      const trafficPromises = campaigns.value.map(async (campaign) => {
        try {
          const trafficResponse = await logsAPI.getTrafficByLaunch(campaign.id);
          const trafficData = trafficResponse.traffic || {};
          // Calculate total traffic for the campaign
          const totalTraffic = Object.values(trafficData).reduce((sum, count) => sum + count, 0);
          return { campaignId: campaign.id, traffic: totalTraffic };
        } catch (error) {
          console.error(`Failed to fetch traffic for campaign ${campaign.id}:`, error);
          return { campaignId: campaign.id, traffic: 0 };
        }
      });
      
      const trafficResults = await Promise.all(trafficPromises);
      
      // Update campaigns with traffic data
      trafficResults.forEach(({ campaignId, traffic }) => {
        const campaign = campaigns.value.find(c => c.id === campaignId);
        if (campaign) {
          campaign.traffic = traffic;
        }
      });
    } catch (error) {
      console.error('Failed to fetch traffic data:', error);
      // Continue without traffic data
    }
    
    // Reset selections when fetching new data
    selectAllCheckbox.value = false;
    selectedCampaigns.value = [];
  } catch (error) {
    showError('Failed to load campaigns');
  } finally {
    isLoading.value = false;
  }
};

const fetchStores = async () => {
  try {
    const data = await shopifyApi.listStores({ limit: 100, status: 'active' });
    stores.value = data.stores || [];
  } catch (error) {
  }
};

const fetchTemplates = async () => {
  loadingTemplates.value = true;
  try {
    const data = await templatesApi.getTemplatesList();
    templates.value = data.templates || [];
  } catch (error) {
    showError('Failed to load templates');
  } finally {
    loadingTemplates.value = false;
  }
};

const fetchSparks = async () => {
  try {
    const data = await sparksApi.listSparks({ limit: 100, status: 'active' });
    sparks.value = data.sparks || [];
  } catch (error) {
  }
};

const searchCampaigns = () => {
  fetchCampaigns();
};

const openCreateModal = () => {
  editingCampaign.value = null;
  formData.value = {
    name: '',
    description: '',
    status: 'draft',
    tiktokStoreId: '',
    redirectStoreId: '',
    redirectType: 'shopify',
    customRedirectUrl: '',
    templateId: '',
    sparkId: '',
    regions: [],
    affiliateLinks: {}
  };
  expandedPanels.value = [];
  showCreateModal.value = true;
};

const openEditModal = async (campaign) => {
  try {
    const data = await campaignsApi.getCampaign(campaign.id);
    editingCampaign.value = data;
    
    formData.value = {
      name: data.name,
      description: data.description || '',
      status: data.status,
      tiktokStoreId: data.tiktokStoreId,
      redirectStoreId: data.redirectStoreId || '',
      redirectType: data.redirectType || 'shopify',
      customRedirectUrl: data.customRedirectUrl || '',
      templateId: data.templateId || '',
      sparkId: data.sparkId || '',
      regions: data.regions || [],
      affiliateLinks: data.affiliateLinks || {}
    };
    
    expandedPanels.value = data.regions || [];
    showCreateModal.value = true;
  } catch (error) {
    showError('Failed to load campaign details');
  }
};

const closeModal = () => {
  showCreateModal.value = false;
  editingCampaign.value = null;
  campaignForm.value?.reset();
};

const saveCampaign = async () => {
  const { valid } = await campaignForm.value.validate();
  if (!valid) return;
  
  saving.value = true;
  try {
    const campaignData = {
      ...formData.value,
      isActive: formData.value.status === 'active'
    };
    
    // Find store names
    const tiktokStore = stores.value.find(s => s.id === campaignData.tiktokStoreId);
    if (tiktokStore) {
      campaignData.tiktokStoreName = tiktokStore.store_name;
    }
    
    if (campaignData.redirectType === 'shopify' && campaignData.redirectStoreId) {
      const redirectStore = stores.value.find(s => s.id === campaignData.redirectStoreId);
      if (redirectStore) {
        campaignData.redirectStoreName = redirectStore.store_name;
      }
    }
    
    // Find spark name
    if (campaignData.sparkId) {
      const spark = sparks.value.find(s => s.id === campaignData.sparkId);
      if (spark) {
        campaignData.sparkName = spark.name;
      }
    }
    
    let data;
    if (editingCampaign.value) {
      data = await campaignsApi.updateCampaign(editingCampaign.value.id, campaignData);
    } else {
      data = await campaignsApi.createCampaign(campaignData);
    }
    
    showSuccess(editingCampaign.value ? 'Campaign updated successfully' : 'Campaign created successfully');
    closeModal();
    fetchCampaigns();
  } catch (error) {
    showError(editingCampaign.value ? 'Failed to update campaign' : 'Failed to create campaign');
  } finally {
    saving.value = false;
  }
};


const confirmDelete = (campaign) => {
  deletingCampaign.value = campaign;
  showDeleteDialog.value = true;
};

const deleteCampaign = async () => {
  if (!deletingCampaign.value) return;
  
  deleting.value = true;
  try {
    await campaignsApi.deleteCampaign(deletingCampaign.value.id);
    showSuccess('Campaign deleted successfully');
    showDeleteDialog.value = false;
    fetchCampaigns();
  } catch (error) {
    showError('Failed to delete campaign');
  } finally {
    deleting.value = false;
    deletingCampaign.value = null;
  }
};

const bulkDelete = async () => {
  if (selectedCampaigns.value.length === 0) return;
  
  if (!confirm(`Delete ${selectedCampaigns.value.length} campaigns?`)) return;
  
  try {
    await Promise.all(
      selectedCampaigns.value.map(id => campaignsApi.deleteCampaign(id))
    );
    showSuccess(`${selectedCampaigns.value.length} campaigns deleted`);
    selectedCampaigns.value = [];
    fetchCampaigns();
  } catch (error) {
    showError('Failed to delete some campaigns');
  }
};

const bulkUpdateStatus = async (status) => {
  if (selectedCampaigns.value.length === 0) return;
  
  try {
    await Promise.all(
      selectedCampaigns.value.map(id => campaignsApi.updateCampaignStatus(id, status))
    );
    showSuccess(`${selectedCampaigns.value.length} campaigns updated to ${status}`);
    selectedCampaigns.value = [];
    fetchCampaigns();
  } catch (error) {
    showError('Failed to update some campaigns');
  }
};

const duplicateCampaign = async (campaign) => {
  try {
    const data = await campaignsApi.getCampaign(campaign.id);
    
    const newCampaign = {
      ...data,
      name: `${data.name} (Copy)`,
      status: 'draft',
      isActive: false,
      traffic: 0
    };
    
    delete newCampaign.id;
    delete newCampaign.createdAt;
    delete newCampaign.updatedAt;
    
    await campaignsApi.createCampaign(newCampaign);
    showSuccess('Campaign duplicated successfully');
    fetchCampaigns();
  } catch (error) {
    showError('Failed to duplicate campaign');
  }
};

const toggleActive = async (campaign) => {
  try {
    await campaignsApi.toggleCampaignActive(campaign.id);
    showSuccess(`Campaign ${campaign.isActive ? 'activated' : 'deactivated'}`);
  } catch (error) {
    showError('Failed to toggle campaign status');
    campaign.isActive = !campaign.isActive;
  }
};

const openStatusMenu = (campaign, event) => {
  currentCampaign.value = campaign;
  statusMenuTarget.value = event.target;
  showStatusMenu.value = true;
};

const updateStatus = async (status) => {
  if (!currentCampaign.value) return;
  
  try {
    await campaignsApi.updateCampaignStatus(currentCampaign.value.id, status);
    currentCampaign.value.status = status;
    showSuccess('Campaign status updated');
    showStatusMenu.value = false;
  } catch (error) {
    showError('Failed to update status');
  }
};

const updateCampaignStatus = async (campaignId, status) => {
  try {
    await campaignsApi.updateCampaignStatus(campaignId, status);
    // Update the campaign in the local list
    const campaign = campaigns.value.find(c => c.id === campaignId);
    if (campaign) {
      campaign.status = status;
    }
    showSuccess('Campaign status updated');
  } catch (error) {
    showError('Failed to update status');
    // Refresh the list to revert the change
    fetchCampaigns();
  }
};

const openLaunchesModal = async (campaign) => {
  try {
    // Fetch fresh campaign data
    const data = await campaignsApi.getCampaign(campaign.id);
    currentCampaign.value = data;
    
    // Fetch traffic data for this campaign
    let trafficData = {};
    try {
      const trafficResponse = await logsAPI.getTrafficByLaunch(campaign.id);
      trafficData = trafficResponse.traffic || {};
    } catch (error) {
      console.error('Failed to fetch traffic data:', error);
      // Continue without traffic data
    }
    
    // Convert launches object to array and sort by number
    if (data.launches && Object.keys(data.launches).length > 0) {
      const launchesArray = Object.entries(data.launches)
        .map(([num, launch]) => ({
          ...launch,
          number: parseInt(num),
          traffic: trafficData[num] || 0  // Add traffic count from logs
        }))
        .sort((a, b) => a.number - b.number);
      currentLaunches.value = launchesArray;
    } else {
      // Initialize with default launch if none exist
      currentLaunches.value = [{
        number: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        generatedAt: null,
        traffic: trafficData[0] || 0
      }];
    }
    
    newLaunchCount.value = 1;
    showLaunchesModal.value = true;
  } catch (error) {
    showError('Failed to load launch details');
  }
};

const addNewLaunches = async () => {
  if (!currentCampaign.value || !newLaunchCount.value) return;
  
  addingLaunches.value = true;
  try {
    const newLaunches = [];
    
    // Add launches one by one using the manageLaunches API
    for (let i = 0; i < newLaunchCount.value; i++) {
      const result = await campaignsApi.manageLaunches(currentCampaign.value.id, 'add', {});
      if (result.success && result.result?.launchNumber !== undefined) {
        newLaunches.push(result.result.launchNumber);
      }
    }
    
    if (newLaunches.length > 0) {
      showSuccess(`Successfully added ${newLaunches.length} new launch(es): ${newLaunches.join(', ')}`);
      
      // Refresh the modal
      await openLaunchesModal(currentCampaign.value);
      
      // Refresh main campaigns list
      fetchCampaigns();
    } else {
      showError('Failed to add launches');
    }
  } catch (error) {
    showError('Failed to add launches: ' + error.message);
  } finally {
    addingLaunches.value = false;
  }
};

const refreshCampaignTraffic = async (campaign) => {
  refreshingTraffic.value = campaign.id;
  try {
    // Fetch latest campaign data which includes traffic stats
    const response = await campaignsApi.getCampaign(campaign.id);
    
    if (response.campaign) {
      const updatedCampaign = response.campaign;
      
      // Update the campaign in the campaigns array
      const campaignIndex = campaigns.value.findIndex(c => c.id === campaign.id);
      if (campaignIndex !== -1) {
        campaigns.value[campaignIndex] = updatedCampaign;
      }
      
      // If the launches modal is open for this campaign, update it
      if (showLaunchesModal.value && currentCampaign.value?.id === campaign.id) {
        currentCampaign.value = updatedCampaign;
        
        // Update launches with the latest data
        const launches = updatedCampaign.launches || {};
        currentLaunches.value = Object.entries(launches).map(([num, launch]) => ({
          number: parseInt(num),
          ...launch
        })).sort((a, b) => a.number - b.number);
      }
      
      showSuccess('Traffic data refreshed');
    }
  } catch (error) {
    console.error('Failed to refresh traffic:', error);
    showError('Failed to refresh traffic data');
  } finally {
    refreshingTraffic.value = null;
  }
};

const toggleLaunch = async (launchNumber) => {
  togglingLaunch.value = launchNumber;
  try {
    // Use manageLaunches API to toggle launch status
    const result = await campaignsApi.manageLaunches(currentCampaign.value.id, 'toggle', {
      launchNumber: launchNumber
    });
    
    if (result.success) {
      // Update local state
      const launchIndex = currentLaunches.value.findIndex(l => l.number === launchNumber);
      if (launchIndex !== -1) {
        currentLaunches.value[launchIndex].isActive = result.result?.isActive || !currentLaunches.value[launchIndex].isActive;
      }
      
      showSuccess('Launch status updated');
      
      // Refresh main campaigns list
      fetchCampaigns();
    }
  } catch (error) {
    showError('Failed to update launch status');
  } finally {
    togglingLaunch.value = null;
  }
};

const generateLaunchLink = async (launchNumber) => {
  generatingLinkFor.value = launchNumber;
  try {
    const data = await campaignsApi.generateLink({
      campaignId: currentCampaign.value.id,
      launchNumber: launchNumber,
      params: {
        utm_source: 'tiktok',
        utm_medium: 'cpc',
        utm_campaign: currentCampaign.value.id
      }
    });
    
    if (data.success && data.link) {
      // Copy to clipboard
      await navigator.clipboard.writeText(data.link);
      
      if (data.refreshed) {
        showSuccess('Shopify pages have been refreshed with the latest campaign settings. Link copied to clipboard!');
      } else {
        showSuccess('Link generated and copied to clipboard!');
      }
      
      // Update the generatedAt timestamp in local state
      const launchIndex = currentLaunches.value.findIndex(l => l.number === launchNumber);
      if (launchIndex !== -1) {
        currentLaunches.value[launchIndex].generatedAt = new Date().toISOString();
      }
      
      // Refresh the modal to show updated timestamp and traffic
      setTimeout(() => {
        openLaunchesModal(currentCampaign.value);
      }, 1000);
      
      // Also refresh the main campaigns list to update traffic count
      fetchCampaigns();
    }
  } catch (error) {
    let errorMessage = 'Error generating link: ' + error.message;
    
    // Check for specific error types
    if (error.message?.includes('store is missing admin API token')) {
      errorMessage = 'Error: The TikTok store is missing its Admin API token. Please update the store configuration in Shopify Stores admin.';
    } else if (error.message?.includes('store not found')) {
      errorMessage = 'Error: One of the configured stores was not found. Please check the campaign configuration.';
    } else if (error.message?.includes('Launch') && error.message?.includes('does not exist')) {
      errorMessage = 'Error: ' + error.message + '. Please use the "Add Launches" button first.';
    }
    
    showError(errorMessage);
  } finally {
    generatingLinkFor.value = null;
  }
};


const testStoreConnection = async (storeId, type) => {
  if (!storeId) return;
  
  testingConnection.value[type] = true;
  try {
    const data = await shopifyApi.testConnection(storeId);
    
    if (data.connected) {
      showSuccess(`${type === 'tiktok' ? 'TikTok' : 'Redirect'} store connected successfully`);
    } else {
      showError(data.error || 'Connection failed');
    }
  } catch (error) {
    showError('Failed to test connection');
  } finally {
    testingConnection.value[type] = false;
  }
};

const onRedirectTypeChange = () => {
  if (formData.value.redirectType === 'custom') {
    formData.value.redirectStoreId = '';
  } else {
    formData.value.customRedirectUrl = '';
  }
};

// Helper functions
const getStatusColor = (status) => {
  const colors = {
    draft: 'grey',
    active: 'success',
    paused: 'warning',
    completed: 'info'
  };
  return colors[status] || 'grey';
};

const getRegionName = (region) => {
  const regionObj = availableRegions.find(r => r.value === region);
  return regionObj ? regionObj.title : region;
};

const getActiveLaunches = (campaign) => {
  if (!campaign.launches) return 1;
  return Object.values(campaign.launches).filter(l => l.isActive).length;
};

const getTotalLaunches = (campaign) => {
  if (!campaign.launches) return 1;
  return Object.keys(campaign.launches).length;
};

const getTrafficPercentage = (campaign, type) => {
  const total = campaign.traffic || 0;
  if (total === 0) return 0;
  
  if (type === 'passed') {
    return ((campaign.trafficPassed || 0) / total * 100).toFixed(1);
  } else if (type === 'blocked') {
    return ((campaign.trafficBlocked || 0) / total * 100).toFixed(1);
  }
  return 0;
};

const getTemplateName = (templateId) => {
  if (!templateId) return null;
  const template = templates.value.find(t => t.id === templateId);
  return template ? template.name : 'Unknown template';
};

const getLaunchOptions = () => {
  if (!currentCampaign.value?.launches) {
    return [{ title: 'Launch #0 (Default)', value: 0 }];
  }
  
  return Object.keys(currentCampaign.value.launches).map(num => ({
    title: `Launch #${num}${num === '0' ? ' (Default)' : ''}`,
    value: parseInt(num)
  }));
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

const getTimeSinceGenerated = (generatedAt) => {
  if (!generatedAt) return { hours: 0, days: 0 };
  
  const genDate = new Date(generatedAt);
  const now = new Date();
  const diffMs = now - genDate;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  return { hours, days };
};

const toggleSelection = (campaignId) => {
  const index = selectedCampaigns.value.indexOf(campaignId);
  if (index > -1) {
    selectedCampaigns.value.splice(index, 1);
  } else {
    selectedCampaigns.value.push(campaignId);
  }
  
  // Update select all checkbox state
  selectAllCheckbox.value = selectedCampaigns.value.length === campaigns.value.length && campaigns.value.length > 0;
};

const toggleSelectAll = () => {
  if (selectedCampaigns.value.length === campaigns.value.length && campaigns.value.length > 0) {
    // All are selected, so deselect all
    selectedCampaigns.value = [];
    selectAllCheckbox.value = false;
  } else {
    // Not all are selected, so select all
    selectedCampaigns.value = campaigns.value.map(c => c.id);
    selectAllCheckbox.value = true;
  }
};

const clearSelection = () => {
  selectedCampaigns.value = [];
  selectAllCheckbox.value = false;
};

const changePage = (page) => {
  currentPage.value = page;
  fetchCampaigns();
};

// Launch count controls
const incrementLaunchCount = () => {
  if (newLaunchCount.value < 10) {
    newLaunchCount.value++;
  }
};

const decrementLaunchCount = () => {
  if (newLaunchCount.value > 1) {
    newLaunchCount.value--;
  }
};

const validateLaunchCount = () => {
  if (newLaunchCount.value < 1) {
    newLaunchCount.value = 1;
  } else if (newLaunchCount.value > 10) {
    newLaunchCount.value = 10;
  }
};

// Watch regions to update expanded panels
watch(() => formData.value.regions, (newRegions) => {
  expandedPanels.value = newRegions;
});

// Lifecycle
onMounted(() => {
  fetchCampaigns();
  fetchStores();
  fetchTemplates();
  fetchSparks();
});
</script>

<style scoped>
.campaigns-container {
}

.cursor-pointer {
  cursor: pointer;
}

.campaign-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
  overflow: hidden;
}

.campaign-card:hover {
  border-color: rgba(0, 0, 0, 0.12);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.v-theme--dark .campaign-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.v-theme--dark .campaign-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 8px 32px rgba(255, 255, 255, 0.08);
}

.campaign-header {
  background-color: rgba(0, 0, 0, 0.02);
}

.v-theme--dark .campaign-header {
  background-color: rgba(255, 255, 255, 0.02);
}

/* Mobile Responsive Styles */
@media (max-width: 600px) {
  .campaigns-container {
    padding: 8px !important;
  }
  
  .campaign-header {
    padding: 12px !important;
  }
  
  .campaign-header .d-flex {
    flex-wrap: wrap;
  }
  
  .campaign-header .d-flex.align-center.justify-space-between {
    flex-direction: column;
    align-items: flex-start !important;
  }
  
  .campaign-header .d-flex.gap-1 {
    width: 100%;
    justify-content: flex-end;
    margin-top: 8px;
  }
  
  .campaign-status-select {
    max-width: 120px !important;
  }
  
  .text-subtitle-1 {
    font-size: 0.875rem !important;
  }
  
  .section-title {
    font-size: 0.625rem !important;
  }
  
  .info-section {
    min-height: auto !important;
    padding: 8px !important;
  }
  
  .regions-grid {
    gap: 0.125rem !important;
  }
  
  .stat-value {
    font-size: 1rem !important;
  }
  
  .bulk-actions-bar {
    flex-wrap: wrap;
  }
  
  .bulk-actions-bar .v-btn {
    margin: 2px;
  }
}

@media (max-width: 960px) {
  .campaign-content {
    padding: 12px !important;
  }
  
  .campaign-content .v-row {
    margin: 0 !important;
  }
  
  .campaign-content .v-col {
    padding: 4px !important;
  }
}

.status-chip {
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.625rem;
}

.section-title {
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
}

.v-theme--dark .section-title {
  color: rgba(255, 255, 255, 0.6);
}

.info-section {
  min-height: 80px;
}

.store-item {
  margin-bottom: 0.5rem;
}

.store-value {
  font-size: 0.875rem;
  display: flex;
  align-items: center;
}

.regions-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.stats-section {
  text-align: center;
}

.stat-item {
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
  margin-top: 0.25rem;
}

.v-theme--dark .stat-label {
  color: rgba(255, 255, 255, 0.6);
}

/* Compact Traffic Indicators */
.traffic-row {
  min-height: 32px;
}

.traffic-indicator {
  border-radius: 6px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  cursor: default;
}

.traffic-indicator.passed-traffic {
  background: rgba(76, 175, 80, 0.1);
  color: #2e7d32;
}

.v-theme--dark .traffic-indicator.passed-traffic {
  background: rgba(76, 175, 80, 0.15);
  color: #66bb6a;
}

.traffic-indicator.blocked-traffic {
  background: rgba(244, 67, 54, 0.1);
  color: #c62828;
}

.v-theme--dark .traffic-indicator.blocked-traffic {
  background: rgba(244, 67, 54, 0.15);
  color: #ef5350;
}

.traffic-indicator.disabled-traffic {
  background: rgba(158, 158, 158, 0.1);
  color: #616161;
}

.v-theme--dark .traffic-indicator.disabled-traffic {
  background: rgba(158, 158, 158, 0.15);
  color: #9e9e9e;
}

@media (max-width: 600px) {
  .traffic-indicator {
    font-size: 0.75rem;
  }
}

/* Launch Traffic Stats */
.launch-traffic-stats {
  padding: 4px 8px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.04);
  font-size: 0.75rem;
}

.v-theme--dark .launch-traffic-stats {
  background-color: rgba(255, 255, 255, 0.08);
}

.launches-btn {
  width: 100%;
}

.campaign-card .v-btn--variant-plain {
  opacity: 1 !important;
}

.campaign-card .v-btn--variant-plain .v-icon {
  opacity: 1 !important;
}

.campaign-card .v-btn--variant-plain:hover {
  opacity: 0.8;
}

/* Launch Modal Styles */
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
}

.v-theme--dark .border-b {
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.border-green-darken-1 {
  border-color: rgba(76, 175, 80, 0.5) !important;
}

.border-grey {
  border-color: rgba(158, 158, 158, 0.5) !important;
}

/* Launch count input with stepper buttons */
.launch-count-wrapper {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgb(134, 239, 172); /* green-300 */
  border-radius: 4px;
  background-color: white;
  overflow: hidden;
}

.launch-count-wrapper.purple-theme {
  border-color: rgb(216, 180, 254); /* purple-300 */
}

.launch-count-input {
  border: none;
  padding: 6px 8px;
  font-size: 0.875rem;
  line-height: 1.25rem;
  background-color: transparent;
  color: rgba(0, 0, 0, 0.87);
  text-align: center;
  width: 50px;
  height: 32px;
  -moz-appearance: textfield;
}

.launch-count-input:focus {
  outline: none;
}

.launch-count-input::-webkit-inner-spin-button,
.launch-count-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.launch-count-btn {
  background-color: transparent;
  border: none;
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
  color: rgb(34, 197, 94); /* green-500 */
  min-width: 32px;
  height: 32px;
}

.purple-theme .launch-count-btn {
  color: rgb(168, 85, 247); /* purple-500 */
}

.launch-count-btn:hover:not(:disabled) {
  background-color: rgba(134, 239, 172, 0.2);
}

.purple-theme .launch-count-btn:hover:not(:disabled) {
  background-color: rgba(216, 180, 254, 0.2);
}

.launch-count-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
  color: rgba(0, 0, 0, 0.38);
}

.launch-count-btn.minus {
  border-right: 1px solid rgb(134, 239, 172);
}

.purple-theme .launch-count-btn.minus {
  border-right: 1px solid rgb(216, 180, 254);
}

.launch-count-btn.plus {
  border-left: 1px solid rgb(134, 239, 172);
}

.purple-theme .launch-count-btn.plus {
  border-left: 1px solid rgb(216, 180, 254);
}

/* Dark theme support */
.v-theme--dark .launch-count-wrapper {
  background-color: rgba(255, 255, 255, 0.09);
  border-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-wrapper.purple-theme {
  border-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-input {
  color: rgba(255, 255, 255, 0.87);
}

.v-theme--dark .launch-count-btn {
  color: rgba(168, 85, 247, 0.9);
}

.v-theme--dark .purple-theme .launch-count-btn {
  color: rgba(168, 85, 247, 0.9);
}

.v-theme--dark .launch-count-btn:hover:not(:disabled) {
  background-color: rgba(168, 85, 247, 0.1);
}

.v-theme--dark .launch-count-btn:disabled {
  color: rgba(255, 255, 255, 0.3);
}

.v-theme--dark .launch-count-btn.minus {
  border-right-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .purple-theme .launch-count-btn.minus {
  border-right-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .launch-count-btn.plus {
  border-left-color: rgba(168, 85, 247, 0.5);
}

.v-theme--dark .purple-theme .launch-count-btn.plus {
  border-left-color: rgba(168, 85, 247, 0.5);
}

/* Custom scrollbar for launches list */
.launches-scroll::-webkit-scrollbar {
  width: 8px;
}

.launches-scroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
}

.launches-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.launches-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.v-theme--dark .launches-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.v-theme--dark .launches-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.v-theme--dark .launches-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Active chip menu */
.active-chip-menu {
  cursor: pointer;
}

.active-chip-menu:hover {
  opacity: 0.8;
}

/* Slide fade transition */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateX(10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-10px);
  opacity: 0;
}

/* Cursor pointer utility */
.cursor-pointer {
  cursor: pointer;
}

/* Campaign status select */
.campaign-status-select :deep(.v-field) {
  background-color: transparent !important;
  box-shadow: none !important;
}

.campaign-status-select :deep(.v-field__input) {
  padding: 0;
  min-height: auto;
}

.campaign-status-select :deep(.v-field__append-inner) {
  padding-top: 0;
}

</style>