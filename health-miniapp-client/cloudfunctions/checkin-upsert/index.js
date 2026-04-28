const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

function formatDate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const userId = wxContext.OPENID
  
  const { waterMl, steps, sleepHours, mood, note } = event
  
  try {
    const todayStr = formatDate(new Date())
    const today = new Date(`${todayStr}T00:00:00`)
    
    // 查询今日打卡记录
    let todayQuery
    try {
      todayQuery = await db.collection('daily_checkin').where({ userId, dateStr: todayStr }).get()
      if (!todayQuery.data || todayQuery.data.length === 0) {
        todayQuery = await db.collection('daily_checkin').where({ userId, date: today }).get()
      }
    } catch (e) {
      todayQuery = { data: [] }
    }
    
    const checkinData = {
      waterMl: waterMl || null,
      steps: steps || null,
      sleepHours: sleepHours || null,
      mood: mood || '',
      note: note || '',
      dateStr: todayStr,
      updatedAt: db.serverDate(),
      updatedAtMs: Date.now()
    }
    
    let result
    if (todayQuery.data.length === 0) {
      // 新增
      checkinData.userId = userId
      checkinData.date = today
      const addRes = await db.collection('daily_checkin').add({
        data: checkinData
      })
      checkinData._id = addRes._id
    } else {
      // 更新
      const id = todayQuery.data[0]._id
      await db.collection('daily_checkin').doc(id).update({
        data: checkinData
      })
      checkinData._id = id
    }
    
    return {
      success: true,
      data: checkinData
    }
  } catch (err) {
    console.error('Checkin upsert error:', err)
    return { 
      success: false, 
      message: '保存打卡失败' 
    }
  }
}
