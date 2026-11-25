local H = {}
function H.distance(a, b)
    local aq = a.col - math.floor(a.row/2)
    local bq = b.col - math.floor(b.row/2)
    local dq, dr = aq-bq, a.row-b.row
    return (math.abs(dq)+math.abs(dr)+math.abs(dq+dr))/2
end
function H.position(col, row)
    return (col + (row%2)*0.5 - 3.25)*3.8, (row-3.5)*3.3
end
function H.valid(col, row, half)
    return type(col)=="number" and type(row)=="number" and col==math.floor(col) and row==math.floor(row)
        and col>=0 and col<7 and row>=0 and row<(half and 4 or 8)
end
return H
