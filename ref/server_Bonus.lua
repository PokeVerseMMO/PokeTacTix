-- Bonus round (every 10th round): 3 shared-pool heroes + 8 random equipment pieces. Commanders pick lowest HP first.
local RS=game:GetService("ReplicatedStorage")
local C=require(RS.AutoChess.Config)
local R=require(RS.AutoChess.Roster)
local G=require(script.Parent.Game)
local M={Interval=10,PickSeconds=15,ItemCount=8}
local RANK={Rare=3,Epic=4,Legendary=5}

function M.due(round) return round>0 and round%M.Interval==0 end

-- Draw one hero of `tier` from the shared pool (weighted by copies left). Falls back to lower tiers if the tier is empty.
local function draw(m,tier,taken)
    for t=tier,1,-1 do
        local candidates,total={},0
        for _,d in ipairs(R.List) do
            if d.tier==t and not d.npc and m.pool[d.id]>0 and not taken[d.id] then
                total+=m.pool[d.id];table.insert(candidates,d.id)
            end
        end
        if total>0 then
            local roll=math.random(total)
            for _,id in ipairs(candidates) do
                roll-=m.pool[id]
                if roll<=0 then m.pool[id]-=1;taken[id]=true;return id end
            end
        end
    end
end

function M.offers(m)
    local plan=m.round<=10 and {4,4,3} or {5,5,4}
    local list,taken={},{}
    for _,tier in ipairs(plan) do
        local id=draw(m,tier,taken)
        if id then table.insert(list,{kind="hero",id=id,tier=R.ById[id].tier}) end
    end
    -- 8 distinct random items: Rare/Epic at the first bonus, Epic/Legendary afterwards.
    local pool,rest={},{}
    local want=m.round<=10 and {Rare=true,Epic=true} or {Epic=true,Legendary=true}
    for index,item in ipairs(C.Items) do table.insert(want[item.rarity] and pool or rest,index) end
    for i=#pool,2,-1 do local j=math.random(i);pool[i],pool[j]=pool[j],pool[i] end
    for i=#rest,2,-1 do local j=math.random(i);rest[i],rest[j]=rest[j],rest[i] end
    for _,index in ipairs(rest) do table.insert(pool,index) end
    for k=1,math.min(M.ItemCount,#pool) do
        local item=C.Items[pool[k]]
        table.insert(list,{kind="item",item=pool[k],id=item.id,rarity=item.rarity,tier=RANK[item.rarity] or 3})
    end
    return list
end

local function grant(m,p,o)
    if o.kind=="item" then table.insert(p.items,o.item);return end
    table.insert(p.units,G.unit(o.id))
    G.merge(p)
    -- Bench overflow is sold back instead of being lost.
    while G.count(p,false)>C.BenchSize do
        local last
        for i=#p.units,1,-1 do if p.units[i].col==nil then last=p.units[i];break end end
        if not last then break end
        G.sell(m,p,last.uid)
    end
end

local function score(o) return o.tier*(o.kind=="hero" and 10 or 9) end

-- `humans()` returns {{player=,me=}} for connected humans; `push()` sends state to all of them; `alive()` aborts when the match is gone.
function M.run(m,humans,push,alive)
    local offers=M.offers(m)
    local order={}
    local isHuman={}
    for _,h in ipairs(humans()) do isHuman[h.me]=true end
    for i,p in ipairs(m.players) do
        if p.hp>0 then table.insert(order,{seat=i,name=p.name,commander=p.commander,hp=p.hp,human=isHuman[i]==true}) end
    end
    table.sort(order,function(a,b) if a.hp~=b.hp then return a.hp<b.hp end return a.seat<b.seat end)
    local b={round=m.round,offers=offers,order=order,turn=0,seconds=0,limit=M.PickSeconds,serial=0}
    m.bonus=b;m.phase="Bonus"
    push()
    task.wait(2.5) -- intro: commanders line up
    for turn=1,#order do
        local free={}
        for i,o in ipairs(b.offers) do if not o.taker then table.insert(free,i) end end
        if #free==0 or not alive() then break end
        local entry=order[turn]
        local p=m.players[entry.seat]
        b.turn=turn;b.choice=nil;b.serial+=1
        local deadline=os.clock()+M.PickSeconds
        local pick
        if not entry.human then
            b.seconds=0;push()
            task.wait(1.2)
            local best
            for _,i in ipairs(free) do if not best or score(b.offers[i])>score(b.offers[best]) then best=i end end
            pick=best
        else
            while alive() do
                b.seconds=math.max(0,math.ceil(deadline-os.clock()))
                push()
                if b.choice and not b.offers[b.choice].taker then pick=b.choice;break end
                b.choice=nil
                if os.clock()>=deadline then break end
                task.wait(.25)
            end
            if not pick then pick=free[math.random(#free)] end -- AFK: random platform
        end
        if not alive() then break end
        local o=b.offers[pick]
        o.taker=entry.seat;o.takerName=entry.name
        grant(m,p,o)
        b.seconds=0;push()
        task.wait(1.4) -- hop animation
    end
    -- unclaimed heroes return to the pool
    for _,o in ipairs(b.offers) do if not o.taker and o.kind=="hero" then m.pool[o.id]+=1 end end
    b.turn=#order+1;push();task.wait(.8)
    m.bonus=nil;m.phase="Preparation"
end

-- Called from the remote handler (phase is "Bonus").
function M.pick(m,me,index)
    local b=m.bonus
    if not b or m.phase~="Bonus" or type(index)~="number" or index~=math.floor(index) then return end
    local entry=b.order[b.turn]
    if not entry or entry.seat~=me or not b.offers[index] or b.offers[index].taker then return end
    b.choice=index
end

-- Client-safe snapshot.
function M.view(m)
    local b=m.bonus
    if not b then return nil end
    local offers={}
    for i,o in ipairs(b.offers) do offers[i]={kind=o.kind,id=o.id,item=o.item,rarity=o.rarity,tier=o.tier,taker=o.taker,takerName=o.takerName} end
    local order={}
    for i,e in ipairs(b.order) do order[i]={seat=e.seat,name=e.name,commander=e.commander,hp=e.hp} end
    return {round=b.round,offers=offers,order=order,turn=b.turn,seconds=b.seconds,limit=b.limit}
end
return M
