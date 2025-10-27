/**
 * Huvudlogik för Outlook-tillägget
 */

(function() {
  'use strict';
  
  // Global state
  let currentItem = null;
  let meetingData = null;
  let participantSettings = {};
  
  // Initialisera när Office.js är redo
  Office.onReady((info) => {
    if (info.host === Office.HostType.Outlook) {
      initializeApp();
    }
  });
  
  /**
   * Initialisera applikationen
   */
  function initializeApp() {
    // Hämta aktuell kalenderhändelse
    currentItem = Office.context.mailbox.item;
    
    // Kontrollera autentisering
    if (OAuth2Client.isAuthenticated()) {
      showMainView();
      loadMeetingData();
    } else {
      showLoginView();
    }
    
    // Bind event handlers
    bindEventHandlers();
  }
  
  /**
   * Bind event handlers
   */
  function bindEventHandlers() {
    // Login
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Create meeting
    document.getElementById('createMeetingBtn').addEventListener('click', handleCreateMeeting);
    document.getElementById('cancelSettingsBtn').addEventListener('click', hideParticipantSettings);
    document.getElementById('confirmCreateBtn').addEventListener('click', handleConfirmCreate);
    
    // Meeting created
    document.getElementById('copyLinkBtn').addEventListener('click', handleCopyLink);
    document.getElementById('doneBtn').addEventListener('click', handleDone);
    
    // Error
    document.getElementById('closeErrorBtn').addEventListener('click', hideError);
  }
  
  /**
   * Visa login-vy
   */
  function showLoginView() {
    document.getElementById('loginView').style.display = 'block';
    document.getElementById('mainView').style.display = 'none';
    document.getElementById('userInfo').style.display = 'none';
  }
  
  /**
   * Visa huvudvy
   */
  function showMainView() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('mainView').style.display = 'block';
    document.getElementById('userInfo').style.display = 'flex';
    
    // Ladda användarinfo
    loadUserInfo();
  }
  
  /**
   * Hantera inloggning
   */
  async function handleLogin() {
    try {
      showLoading(i18n.t('auth.loggingIn'));
      
      await OAuth2Client.login();
      
      hideLoading();
      showMainView();
      loadMeetingData();
      
    } catch (error) {
      hideLoading();
      showError(i18n.t('auth.loginError') + ': ' + error.message);
    }
  }
  
  /**
   * Hantera utloggning
   */
  function handleLogout() {
    OAuth2Client.logout();
    showLoginView();
  }
  
  /**
   * Ladda användarinfo
   */
  async function loadUserInfo() {
    try {
      const status = await NextcloudAPIClient.getStatus();
      if (status.user) {
        document.getElementById('userName').textContent = status.user.displayName || status.user.uid;
      }
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  }
  
  /**
   * Ladda mötesdata från Outlook
   */
  function loadMeetingData() {
    if (!currentItem) return;
    
    // Hämta mötesdata
    currentItem.subject.getAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        document.getElementById('meetingTitle').textContent = result.value || '-';
      }
    });
    
    currentItem.start.getAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        document.getElementById('meetingStart').textContent = formatDateTime(result.value);
      }
    });
    
    currentItem.end.getAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        document.getElementById('meetingEnd').textContent = formatDateTime(result.value);
      }
    });
    
    // Hämta deltagare
    loadParticipants();
  }
  
  /**
   * Ladda deltagare
   */
  function loadParticipants() {
    const participants = [];
    
    // Hämta obligatoriska deltagare
    currentItem.requiredAttendees.getAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        result.value.forEach(att => {
          participants.push({
            email: att.emailAddress,
            displayName: att.displayName,
            required: true
          });
        });
      }
      
      // Hämta valfria deltagare
      currentItem.optionalAttendees.getAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          result.value.forEach(att => {
            participants.push({
              email: att.emailAddress,
              displayName: att.displayName,
              required: false
            });
          });
        }
        
        // Uppdatera UI
        displayParticipants(participants);
      });
    });
  }
  
  /**
   * Visa deltagare i UI
   */
  function displayParticipants(participants) {
    const count = participants.length;
    document.getElementById('meetingParticipants').textContent = 
      count > 0 ? `${count} deltagare` : 'Inga deltagare';
    
    // Spara för senare användning
    meetingData = { participants };
  }
  
  /**
   * Hantera skapa möte-knapp
   */
  function handleCreateMeeting() {
    if (!meetingData || !meetingData.participants || meetingData.participants.length === 0) {
      showError('Lägg till deltagare i mötet innan du skapar ett Talk-möte');
      return;
    }
    
    // Visa deltagarinställningar
    showParticipantSettings();
  }
  
  /**
   * Visa deltagarinställningar
   */
  function showParticipantSettings() {
    const section = document.getElementById('participantSettingsSection');
    const list = document.getElementById('participantsList');
    
    // Rensa tidigare innehåll
    list.innerHTML = '';
    
    // Skapa inställningskort för varje deltagare
    meetingData.participants.forEach((participant, index) => {
      const card = createParticipantCard(participant, index);
      list.appendChild(card);
      
      // Initiera standardinställningar
      participantSettings[participant.email] = {
        authLevel: 'none',
        secureEmail: false,
        notification: 'email'
      };
    });
    
    // Visa sektionen
    section.style.display = 'block';
    
    // Scrolla till sektionen
    section.scrollIntoView({ behavior: 'smooth' });
  }
  
  /**
   * Skapa deltagarinställningskort
   */
  function createParticipantCard(participant, index) {
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.innerHTML = `
      <div class="participant-header">
        <div>
          <div class="participant-email">${participant.displayName || participant.email}</div>
          <div style="font-size: 0.85rem; color: #666;">${participant.email}</div>
        </div>
        <button class="participant-toggle" data-index="${index}">▼</button>
      </div>
      <div class="participant-settings" data-index="${index}">
        <div class="form-group">
          <label for="authLevel_${index}">${i18n.t('participant.authLevel')}</label>
          <select id="authLevel_${index}" class="form-control" data-email="${participant.email}">
            <option value="none">${i18n.t('participant.authLevel.none')}</option>
            <option value="sms">${i18n.t('participant.authLevel.sms')}</option>
            <option value="loa3">${i18n.t('participant.authLevel.loa3')}</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="personalNumber_${index}">${i18n.t('participant.personalNumber')}</label>
          <input 
            type="text" 
            id="personalNumber_${index}" 
            class="form-control" 
            placeholder="ÅÅÅÅMMDD-XXXX"
            disabled
            data-email="${participant.email}">
        </div>
        
        <div class="form-group">
          <label for="smsNumber_${index}">${i18n.t('participant.smsNumber')}</label>
          <input 
            type="tel" 
            id="smsNumber_${index}" 
            class="form-control" 
            placeholder="+46701234567"
            disabled
            data-email="${participant.email}">
        </div>
        
        <div class="form-group">
          <div class="checkbox-group">
            <input 
              type="checkbox" 
              id="secureEmail_${index}"
              data-email="${participant.email}">
            <label for="secureEmail_${index}">${i18n.t('participant.secureEmail')}</label>
          </div>
        </div>
        
        <div class="form-group">
          <label for="notification_${index}">${i18n.t('participant.notification')}</label>
          <select id="notification_${index}" class="form-control" data-email="${participant.email}">
            <option value="email">${i18n.t('participant.notification.email')}</option>
            <option value="email_sms">${i18n.t('participant.notification.emailSms')}</option>
          </select>
        </div>
      </div>
    `;
    
    // Bind toggle
    const toggle = card.querySelector('.participant-toggle');
    const settings = card.querySelector('.participant-settings');
    toggle.addEventListener('click', () => {
      settings.classList.toggle('expanded');
      toggle.classList.toggle('expanded');
    });
    
    // Bind change events
    const authLevel = card.querySelector(`#authLevel_${index}`);
    const personalNumber = card.querySelector(`#personalNumber_${index}`);
    const smsNumber = card.querySelector(`#smsNumber_${index}`);
    const secureEmail = card.querySelector(`#secureEmail_${index}`);
    const notification = card.querySelector(`#notification_${index}`);
    
    authLevel.addEventListener('change', (e) => {
      updateParticipantSetting(participant.email, 'authLevel', e.target.value);
      updateFieldStates(index, authLevel.value, secureEmail.checked, notification.value);
    });
    
    secureEmail.addEventListener('change', (e) => {
      updateParticipantSetting(participant.email, 'secureEmail', e.target.checked);
      updateFieldStates(index, authLevel.value, e.target.checked, notification.value);
    });
    
    notification.addEventListener('change', (e) => {
      updateParticipantSetting(participant.email, 'notification', e.target.value);
      updateFieldStates(index, authLevel.value, secureEmail.checked, e.target.value);
    });
    
    personalNumber.addEventListener('input', (e) => {
      updateParticipantSetting(participant.email, 'personalNumber', e.target.value);
    });
    
    smsNumber.addEventListener('input', (e) => {
      updateParticipantSetting(participant.email, 'smsNumber', e.target.value);
    });
    
    return card;
  }
  
  /**
   * Uppdatera fältens aktiveringsstatus
   */
  function updateFieldStates(index, authLevel, secureEmail, notification) {
    const personalNumber = document.getElementById(`personalNumber_${index}`);
    const smsNumber = document.getElementById(`smsNumber_${index}`);
    
    // Personnummer aktiveras vid LOA-3 eller säker e-post
    personalNumber.disabled = !(authLevel === 'loa3' || secureEmail);
    
    // SMS-nummer aktiveras vid SMS-autentisering eller SMS-notifiering
    smsNumber.disabled = !(authLevel === 'sms' || notification === 'email_sms');
  }
  
  /**
   * Uppdatera deltagarinställning
   */
  function updateParticipantSetting(email, key, value) {
    if (!participantSettings[email]) {
      participantSettings[email] = {};
    }
    participantSettings[email][key] = value;
  }
  
  /**
   * Dölj deltagarinställningar
   */
  function hideParticipantSettings() {
    document.getElementById('participantSettingsSection').style.display = 'none';
  }
  
  /**
   * Hantera bekräfta skapa möte
   */
  async function handleConfirmCreate() {
    try {
      showLoading(i18n.t('meeting.creating'));
      
      // Hämta mötesdata från Outlook
      const meetingInfo = await getMeetingInfo();
      
      // Förbered API-request
      const requestData = {
        title: meetingInfo.subject,
        start: meetingInfo.start.toISOString(),
        end: meetingInfo.end.toISOString(),
        participants: meetingData.participants.map(p => ({
          email: p.email,
          displayName: p.displayName,
          settings: participantSettings[p.email] || {}
        }))
      };
      
      // Skapa möte via API
      const response = await NextcloudAPIClient.createMeeting(requestData);
      
      // Ta bort Teams-länk från Outlook
      await removeTeamsLink();
      
      // Lägg till Nextcloud Talk-länk
      await addTalkLinkToOutlook(response.meeting);
      
      hideLoading();
      hideParticipantSettings();
      showMeetingCreated(response.meeting);
      
    } catch (error) {
      hideLoading();
      showError(i18n.t('meeting.error') + ': ' + error.message);
    }
  }
  
  /**
   * Hämta mötesinfo från Outlook
   */
  function getMeetingInfo() {
    return new Promise((resolve, reject) => {
      const info = {};
      
      currentItem.subject.getAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          info.subject = result.value;
          
          currentItem.start.getAsync((result) => {
            if (result.status === Office.AsyncResultStatus.Succeeded) {
              info.start = result.value;
              
              currentItem.end.getAsync((result) => {
                if (result.status === Office.AsyncResultStatus.Succeeded) {
                  info.end = result.value;
                  resolve(info);
                } else {
                  reject(new Error('Kunde inte hämta sluttid'));
                }
              });
            } else {
              reject(new Error('Kunde inte hämta starttid'));
            }
          });
        } else {
          reject(new Error('Kunde inte hämta mötestitel'));
        }
      });
    });
  }
  
  /**
   * Ta bort Teams-länk från Outlook-mötet
   */
  async function removeTeamsLink() {
    return new Promise((resolve) => {
      currentItem.body.getAsync(Office.CoercionType.Text, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          let body = result.value;
          
          // Ta bort Teams-relaterat innehåll
          body = body.replace(/Microsoft Teams.*?meeting/gi, '');
          body = body.replace(/Join.*?Teams.*?Meeting/gi, '');
          body = body.replace(/https:\/\/teams\.microsoft\.com\/[^\s]*/gi, '');
          body = body.replace(/Conference ID:.*?\n/gi, '');
          body = body.replace(/________________________________________________________________________________/g, '');
          body = body.trim();
          
          currentItem.body.setAsync(body, { coercionType: Office.CoercionType.Text }, () => {
            resolve();
          });
        } else {
          resolve(); // Fortsätt även om det misslyckas
        }
      });
    });
  }
  
  /**
   * Lägg till Talk-länk i Outlook-mötet
   */
  async function addTalkLinkToOutlook(meeting) {
    return new Promise((resolve) => {
      currentItem.body.getAsync(Office.CoercionType.Text, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          let body = result.value;
          
          // Lägg till Talk-information
          const talkInfo = `\n\n${i18n.t('meeting.joinInstructions')}\n${meeting.talkUrl}\n`;
          body += talkInfo;
          
          currentItem.body.setAsync(body, { coercionType: Office.CoercionType.Text }, () => {
            // Uppdatera även plats-fältet
            currentItem.location.setAsync('Nextcloud Talk (online)', () => {
              resolve();
            });
          });
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Visa möte skapat
   */
  function showMeetingCreated(meeting) {
    document.getElementById('talkLink').value = meeting.talkUrl;
    document.getElementById('meetingCreatedSection').style.display = 'block';
  }
  
  /**
   * Hantera kopiera länk
   */
  function handleCopyLink() {
    const linkInput = document.getElementById('talkLink');
    linkInput.select();
    document.execCommand('copy');
    
    // Visa bekräftelse
    const btn = document.getElementById('copyLinkBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => {
      btn.textContent = originalText;
    }, 2000);
  }
  
  /**
   * Hantera klar-knapp
   */
  function handleDone() {
    document.getElementById('meetingCreatedSection').style.display = 'none';
    loadMeetingData();
  }
  
  /**
   * Visa laddningsoverlay
   */
  function showLoading(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').style.display = 'flex';
  }
  
  /**
   * Dölj laddningsoverlay
   */
  function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
  
  /**
   * Visa felmeddelande
   */
  function showError(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'flex';
    
    // Auto-hide efter 5 sekunder
    setTimeout(hideError, 5000);
  }
  
  /**
   * Dölj felmeddelande
   */
  function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
  }
  
  /**
   * Formatera datum och tid
   */
  function formatDateTime(date) {
    if (!date) return '-';
    
    const d = new Date(date);
    const options = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return d.toLocaleDateString('sv-SE', options);
  }
  
})();

