local C = require(script and game.ReplicatedStorage.AutoChess.Config or "../shared/Config")
local R = require(script and game.ReplicatedStorage.AutoChess.Roster or "../shared/Roster")
local H = require(script and game.ReplicatedStorage.AutoChess.Hex or "../shared/Hex")
local QuickDeployPlan=require(script and game.ReplicatedStorage.AutoChess.QuickDeployPlan or '../shared/QuickDeployPlan')
local G = {}
local EquipmentPlanner=require(script and game.ReplicatedStorage.AutoChess.EquipmentPlanner or '../shared/EquipmentPlanner')
-- Private, per-player sale records. Nothing here is a profile or purchase log.
local saleHistory=setmetatable({},{__mode='k'})
local nextUID = 0
function G.unit(id)
    nextUID = nextUID + 1
    return {uid=nextUID, id=id, stars=1, items={}}
end
function G.count(p, deployed)
    local n=0
    for _, u in ipairs(p.units) do if (u.col~=nil)==deployed then n=n+1 end end
    return n
end
function G.find(p, uid)
    for i,u in ipairs(p.units) do if u.uid==uid then return u,i end end
end
function G.traits(units)
    local counts, seen = {}, {}
    for _,u in ipairs(units) do
        if u.col~=nil and not seen[u.id] and not R.ById[u.id].npc then
            local d=R.ById[u.id]
            seen[u.id]=true
            counts[d.faction]=(counts[d.faction] or 0)+1
            counts[d.role]=(counts[d.role] or 0)+1
        end
    end
    return counts
end
function G.releaseShop(m,p)
    for _,id in pairs(p.shop) do m.pool[id]=m.pool[id]+1 end
    p.shop={}
end
function G.shop(m,p)
    G.releaseShop(m,p)
    for slot=1,C.ShopSize do
        local roll, tier=math.random(100),1
        for t,weight in ipairs(C.ShopOdds[p.level]) do
            roll=roll-weight
            if roll<=0 then tier=t break end
        end
        local candidates, total={},0
        for _,d in ipairs(R.List) do
            if d.tier==tier and m.pool[d.id]>0 then
                total=total+m.pool[d.id]
                table.insert(candidates,d.id)
            end
        end
        if total>0 then
            local choice=math.random(total)
            for _,id in ipairs(candidates) do
                choice=choice-m.pool[id]
                if choice<=0 then p.shop[slot]=id; m.pool[id]=m.pool[id]-1; break end
            end
        end
    end
end
function G.merge(p)
    local again=true
    while again do
        again=false
        for _,candidate in ipairs(p.units) do
            if candidate.stars<3 then
                local matches={}
                for _,u in ipairs(p.units) do
                    if u.id==candidate.id and u.stars==candidate.stars then table.insert(matches,u) end
                end
                if #matches>=3 then
                    -- Preserve a deployed copy and its position whenever possible.
                    table.sort(matches,function(a,b) return (a.col~=nil and 1 or 0)>(b.col~=nil and 1 or 0) end)
                    local keep=matches[1]
                    for j=2,3 do
                        for _,item in ipairs(matches[j].items) do
                            if #keep.items<3 and not table.find(keep.items,item) then table.insert(keep.items,item) else table.insert(p.items,item) end
                        end
                        local _,index=G.find(p,matches[j].uid)
                        table.remove(p.units,index)
                    end
                    keep.stars=keep.stars+1
                    again=true; break
                end
            end
        end
    end
end
function G.buy(m,p,slot)
    local id=p.shop[slot]
    if not id then return false,"That shop slot is empty." end
    local d=R.ById[id]
    if p.gold<d.tier then return false,"Not enough gold." end
    if G.count(p,false)>=C.BenchSize then
        local copies=0
        for _,u in ipairs(p.units) do if u.id==id and u.stars==1 then copies=copies+1 end end
        if copies<2 then return false,"Your bench is full." end
    end
    p.gold=p.gold-d.tier; p.shop[slot]=nil
    table.insert(p.units,G.unit(id)); G.merge(p)
    return true
end
local function returnEquipment(p,u)
    for _,item in ipairs(u.items) do table.insert(p.items,item) end
    table.clear(u.items)
end
function G.sell(m,p,uid,remember)
    local u,index=G.find(p,uid)
    if not u then return false,"Select a fighter first." end
    local copies=3^(u.stars-1)
    if remember then
        local log=saleHistory[p];if not log or log.round~=m.round then log={round=m.round,entries={}};saleHistory[p]=log end
        local snapshot=table.clone(u);snapshot.items=table.clone(u.items)
        table.insert(log.entries,{unit=snapshot,index=index,copies=copies,refund=R.ById[u.id].tier*copies})
        if #log.entries>20 then table.remove(log.entries,1)end
    end
    m.pool[u.id]=m.pool[u.id]+copies
    p.gold=p.gold+R.ById[u.id].tier*copies
    returnEquipment(p,u)
    table.remove(p.units,index)
    return true
end
local function undoCheck(m,p)
    local log=saleHistory[p]
    if not log or log.round~=m.round or #log.entries==0 then return nil,'No character sales to undo this round.'end
    local record=log.entries[#log.entries]
    if m.phase~='Preparation'or p.hp<=0 then return record,'Sales can only be undone during preparation.'end
    if p.gold<record.refund then return record,'You need '..record.refund..' gold to return the sale refund.'end
    if(m.pool[record.unit.id]or 0)<record.copies then return record,'Those copies are currently reserved by another shop or player.'end
    if G.find(p,record.unit.uid)then return record,'That sale has already been restored.'end
    local free=record.unit.col~=nil and G.count(p,true)<p.level
    if free then for _,u in ipairs(p.units)do if u.col==record.unit.col and u.row==record.unit.row then free=false;break end end end
    if not free and G.count(p,false)>=C.BenchSize then return record,'Make space on your bench before undoing this sale.'end
    local available={};for _,item in ipairs(p.items)do available[item]=(available[item]or 0)+1 end
    for _,item in ipairs(record.unit.items)do
        if(available[item]or 0)<1 then return record,'Return the sold hero\'s equipment to your bag before undoing.'end
        available[item]-=1
    end
    return record,nil,free
end
function G.undoInfo(m,p)
    local record,reason=undoCheck(m,p);if not record then return nil end
    return {count=#saleHistory[p].entries,id=record.unit.id,stars=record.unit.stars,refund=record.refund,canUndo=reason==nil,reason=reason}
end
function G.undoSell(m,p)
    local record,reason,deployed=undoCheck(m,p);if reason then return false,reason end
    -- Validate everything before mutation; no yields and no client snapshots.
    local u=table.clone(record.unit);u.items=table.clone(record.unit.items)
    if not deployed then u.col=nil;u.row=nil end
    for _,item in ipairs(u.items)do table.remove(p.items,assert(table.find(p.items,item)))end
    p.gold-=record.refund;m.pool[u.id]-=record.copies
    table.insert(p.units,math.min(record.index,#p.units+1),u);table.remove(saleHistory[p].entries)
    -- A restored copy follows the same automatic upgrade rules as any new copy.
    G.merge(p)
    return true,'Sale undone — '..R.ById[u.id].name..' restored.'
end
function G.move(p,uid,col,row)
    local u=G.find(p,uid)
    if not u then return false,"Select a fighter first." end
    if col==nil then
        if u.col~=nil and G.count(p,false)>=C.BenchSize then return false,"Your bench is full." end
        returnEquipment(p,u)
        u.col=nil; u.row=nil; return true
    end
    if not H.valid(col,row,true) then return false,"Place fighters on your half of the board." end
    local other
    for _,v in ipairs(p.units) do if v.col==col and v.row==row then other=v break end end
    if other==u then return true end
    if not other and u.col==nil and G.count(p,true)>=p.level then return false,"Your army is at capacity. Buy XP to expand it." end
    if other then
        -- Deploying a reserve onto an occupied tile sends that fighter to the
        -- bench too; its equipment must return through the same rule.
        if u.col==nil then returnEquipment(p,other) end
        other.col,other.row=u.col,u.row
    end
    u.col,u.row=col,row
    return true
end
function G.xp(p,amount)
    p.xp=p.xp+amount
    while p.level<C.MaxCapacity and p.xp>=C.XPToLevel[p.level] do
        p.xp=p.xp-C.XPToLevel[p.level]; p.level=p.level+1
    end
    if p.level==C.MaxCapacity then p.xp=0 end
end
function G.quickDeploy(m,p,round)
    if m.phase~="Preparation"or p.hp<=0 or m.tutorial then return false,"Quick Deploy is available during normal preparation."end
    if type(round)~="number"or round~=m.round then return false,"That preparation round has ended."end
    local plan=QuickDeployPlan.plan(p)
    if #plan==0 then return false,"No vacant army slots or reserve fighters available."end
    -- No yields: all placements are validated against this player's current army.
    for _,move in ipairs(plan)do assert(G.move(p,move.uid,move.col,move.row))end
    return true
end
function G.action(m,p,action,a,b,c)
    if action=="quickDeploy"then return G.quickDeploy(m,p,a)end
    if action=="autoEquip"or action=="autoEquipEnd"or action=="replaceEquip"then
        if m.phase~="Preparation"or p.hp<=0 then return false,"Equipment can only be changed during preparation."end
        if action=="autoEquipEnd"then p.autoEquipEnd=not p.autoEquipEnd;return true end
        if action=="autoEquip"then
            local n=EquipmentPlanner.autoEquip(p)
            return n>0,n>0 and("Equipped "..n.." item(s).")or"No available equipment fits your deployed heroes."
        end
        local u=G.find(p,a);local item=p.items[b]
        if not u or not item or type(c)~="number"or c~=math.floor(c)or c<1 or c>3 or not u.items[c]then return false,"Select a bag item and an occupied equipment slot."end
        if table.find(u.items,item)then return false,"This fighter already has that equipment."end
        p.items[b],u.items[c]=u.items[c],item;return true
    end
    if action=="buy" then return G.buy(m,p,a) end
    if action=="sell" then return G.sell(m,p,a,true) end
    if action=="undoSell"then return G.undoSell(m,p)end
    if action=="move" then return G.move(p,a,b,c) end
    if action=="lock" then p.shopLocked=not p.shopLocked;return true end
    if action=="reroll" then
        if p.shopLocked then return false,"Unlock the shop before refreshing." end
        local cost=(p.commander=="Gojo" and not p.rerolled) and 1 or C.RerollCost
        if p.gold<cost then return false,"Not enough gold." end
        p.gold=p.gold-cost; p.rerolled=true; G.shop(m,p); return true
    end
    if action=="xp" then
        if p.level==C.MaxCapacity then return false,"Maximum capacity reached." end
        if p.gold<2 then return false,"You need 2 gold." end
        p.gold=p.gold-2; G.xp(p,4); return true
    end
    if action=="equip" then
        local u=G.find(p,a)
        if not u or not p.items[b] then return false,"Select an item and a fighter." end
        if #u.items>=3 then return false,"A fighter can hold three items." end
        if table.find(u.items,p.items[b]) then return false,"This fighter already has that equipment." end
        table.insert(u.items,table.remove(p.items,b)); return true
    end
    if action=="unequip" then
        local u=G.find(p,a)
        if not u or not u.items[b] then return false,"Select an equipped item." end
        table.insert(p.items,table.remove(u.items,b));return true
    end
    return false,"Unknown action."
end
function G.finishPlanning(m)
    for _,p in ipairs(m.players)do if p.hp>0 and p.autoEquipEnd then EquipmentPlanner.autoEquip(p)end end
end
function G.new(commander,difficulty)
    local m={round=0,pool={},players={},phase="Preparation",difficulty=difficulty}
    for _,d in ipairs(R.List) do m.pool[d.id]=C.PoolCopies[d.tier] end
    for i=1,8 do
        m.players[i]={name=i==1 and "You" or "Rival "..i-1, hp=C.StartingHealth,gold=C.StartingGold,
            level=3,xp=0,units={},items={},shop={},commander=i==1 and commander or C.Commanders[(i-2)%5+1].id,
            faction=C.Factions[(i-2)%5+1]}
    end
    return m
end
function G.newRoom(entries,difficulty)
    local m={round=0,pool={},players={},phase="Preparation",difficulty=difficulty,room=true,seat={},ready={}}
    for _,d in ipairs(R.List) do m.pool[d.id]=C.PoolCopies[d.tier] end
    local seats={1,2,3,4,5,6,7,8}
    for i=#seats,2,-1 do local j=math.random(i);seats[i],seats[j]=seats[j],seats[i] end
    for k,e in ipairs(entries) do
        local i=seats[k]
        m.players[i]={name=e.player.DisplayName,human=e.player,hp=C.StartingHealth,gold=C.StartingGold,level=3,xp=0,
            units={},items={},shop={},commander=e.commander,ui={message="",opponent=""}}
        m.seat[e.player]=i
    end
    local botNumber=0
    for i=1,8 do
        if not m.players[i] then
            botNumber=botNumber+1
            m.players[i]={name="Rival "..botNumber,bot=true,hp=C.StartingHealth,gold=C.StartingGold,level=3,xp=0,units={},items={},shop={},
                commander=C.Commanders[(botNumber-1)%5+1].id,faction=C.Factions[(botNumber-1)%5+1]}
        end
    end
    return m
end
function G.prepare(m)
    m.round=m.round+1; m.phase="Preparation"
    for _,p in ipairs(m.players) do
        saleHistory[p]=nil
        if p.hp>0 then
            if m.round>1 then p.gold=p.gold+5+math.min(5,math.floor(p.gold/10)); G.xp(p,2) end
            p.rerolled=false
            -- A locked shop keeps its remaining units; an emptied one refreshes normally.
            if not (p.shopLocked and next(p.shop)~=nil) then G.shop(m,p) end
        end
    end
end
function G.bot(m,p)
    local advanced=m.difficulty=="Intermediate" or m.difficulty=="Hard"
    local attempts=m.difficulty=="Hard" and 4 or 2
    for attempt=1,attempts do
        local slots={1,2,3,4,5}
        if advanced then
            local function score(slot)
                local d=R.ById[p.shop[slot]]
                if not d then return -1 end
                local s=d.tier+(d.faction==p.faction and 4 or 0)
                for _,u in ipairs(p.units) do if u.id==d.id and u.stars<3 then s=s+5 end end
                return s
            end
            table.sort(slots,function(a,b) return score(a)>score(b) end)
        end
        for _,slot in ipairs(slots) do
            if G.count(p,false)<5 then G.buy(m,p,slot) end
        end
        if p.gold>=6 and attempt<attempts then G.action(m,p,"reroll") end
    end
    if p.gold>=4 and G.count(p,false)>0 then G.action(m,p,"xp") end
    local units={}
    for _,u in ipairs(p.units) do table.insert(units,u); u.col=nil; u.row=nil end
    table.sort(units,function(a,b) return R.ById[a.id].tier*2+a.stars*5>R.ById[b.id].tier*2+b.stars*5 end)
    local occupied={}
    for i,u in ipairs(units) do
        if i<=p.level then
            local front=R.ById[u.id].range==1
            local placed=false
            for rowOffset=0,3 do
                local row=front and 3-rowOffset or rowOffset
                for col=0,6 do
                    local key=row*7+col
                    if not occupied[key] and not placed then
                        u.col=col; u.row=row; occupied[key]=true; placed=true
                    end
                end
            end
        end
    end
    -- Only the final reserves are benched. Repositioning a fielded bot fighter
    -- during formation selection must not strip its equipment unnecessarily.
    for _,u in ipairs(p.units) do if u.col==nil then returnEquipment(p,u) end end
    -- Sell excess bench units rather than violating the bench limit.
    while G.count(p,false)>C.BenchSize do G.sell(m,p,p.units[#p.units].uid) end
    for _,u in ipairs(units) do
        if u.col~=nil and G.find(p,u.uid)==u then
            for index=#p.items,1,-1 do
                if #u.items<3 and not table.find(u.items,p.items[index]) then table.insert(u.items,table.remove(p.items,index)) end
            end
        end
    end
end
function G.eliminate(m,p)
    if p.hp>0 or p.eliminated then return end
    saleHistory[p]=nil;p.eliminated=true; p.hp=0; p.shopLocked=false; G.releaseShop(m,p)
    for _,u in ipairs(p.units) do m.pool[u.id]=m.pool[u.id]+3^(u.stars-1) end
    p.units={}
end
-- Shared rarity schedule avoids an early random Legendary deciding a match.
function G.reward(p,round,won)
    local encounter=math.floor(round/C.NPCRoundInterval)
    -- Creeps: 1, 2, 3, ...; bosses: 3, 4, 5, ... . Each series advances
    -- independently by scheduled round, including after encounters a player lost.
    local count=won and (math.ceil(encounter/2)+(encounter%2==0 and 2 or 0)) or 1
    local rarity=not won and "Rare" or encounter==1 and "Rare" or encounter==2 and "Epic" or encounter%2==0 and "Legendary" or "Epic"
    local choices={};for i,item in ipairs(C.Items) do if item.rarity==rarity then table.insert(choices,i) end end
    local first
    for _=1,count do
        local index=choices[math.random(#choices)]
        table.insert(p.items,index);first=first or index
    end
    if count==1 then return C.Items[first].id..(won and "" or " (consolation)") end
    return count.." equipment ("..rarity..")"
end
return G


