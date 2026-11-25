-- Client selection state. Only the server may grant / reserve a real reward.
local C=require(script and script.Parent.Config or "./Config")
local R=require(script and script.Parent.Roster or "./Roster")
local M={Version=1,Tiers={"Common","Uncommon","Rare","Epic","Legendary"}}
local function offer(self,index) return self.bonus and self.bonus.offers[index] end
function M.new(claim)
    local self={selected=nil,pending=nil,claimCallback=claim}
    function self:update(snapshot)
        local b=snapshot and snapshot.phase=="Bonus" and snapshot.bonus
        if not b then self:reset();return false end
        if not self.bonus or self.bonus.round~=b.round then self.selected=nil;self.pending=nil end
        if self.pending and (self.pending.turn~=b.turn or not b.offers[self.pending.index] or b.offers[self.pending.index].taker) then self.pending=nil end
        self.bonus=b;self.me=snapshot.me
        if self.selected and not offer(self,self.selected) then self.selected=nil end
        return true
    end
    function self:select(index)
        if type(index)~="number" or index%1~=0 or not offer(self,index) then return false end
        self.selected=index;return true
    end
    function self:canClaim()
        local b=self.bonus;local o=self.selected and offer(self,self.selected)
        local turn=b and b.order[b.turn]
        return turn~=nil and turn.seat==self.me and (b.seconds or 0)>0 and o~=nil and not o.taker and not self.pending
    end
    function self:claim()
        if not self:canClaim() then return false end
        local index=self.selected;self.pending={index=index,turn=self.bonus.turn}
        self.claimCallback(index);return true
    end
    function self:reset() self.bonus=nil;self.selected=nil;self.pending=nil;self.me=nil end
    return self
end
local modifiers={
    {"attack","Attack damage",true},{"speed","Attack speed",true},{"health","Maximum HP",true},
    {"armor","Armor"},{"mr","Magic resist"},{"power","Ability power",true},{"crit","Critical chance",true},
    {"healPower","Healing / shielding",true},
}
function M.details(o)
    if o.kind=="hero" then
        local d=assert(R.ById[o.id]);return {name=d.name,rarity=M.Tiers[o.tier] or "Hero",kind="HERO",id=d.id,
            subtitle=(C.FactionNames[d.faction] or d.faction).." · "..d.role,
            stats={{"Health",string.format("%.0f",d.health)},{"Attack",string.format("%.0f",d.attack)},
                {"Attack speed",string.format("%.2f/s",d.speed)},{"Armor / MR",d.armor.." / "..d.mr}},
            ability=d.ability,description=d.description,note="Recruits one 1-star copy. Matching copies can merge."}
    end
    local item=assert(C.Items[o.item]);local rows={}
    for _,stat in ipairs(modifiers) do local value=item[stat[1]]
        if value and value~=0 then table.insert(rows,{stat[2],string.format("%+.0f",stat[3] and value*100 or value)..(stat[3] and "%" or "")}) end
    end
    return {name=item.id,rarity=item.rarity,kind="EQUIPMENT",key=item.key,stats=rows,ability="ITEM EFFECT",
        description=item.text,note="Added to your bag. Equip it during preparation."}
end
return M
